"""Check quota races, signature challenge replay, and saved history isolation."""
import concurrent.futures
import pathlib
import sqlite3
import tempfile

sql = pathlib.Path('drizzle/0000_puzzling_talkback.sql').read_text()
with tempfile.TemporaryDirectory() as temp:
    dbpath = pathlib.Path(temp) / 'checks.sqlite'
    connection = sqlite3.connect(dbpath)
    connection.executescript(sql)
    connection.commit()
    def reserve_once(_):
        with sqlite3.connect(dbpath, timeout=10) as db:
            row = db.execute('INSERT INTO usage (key,used) VALUES (?,1) ON CONFLICT(key) DO UPDATE SET used=used+1 WHERE used<? RETURNING used', ('trial:a',3)).fetchone()
            return row is not None
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
        successes = list(pool.map(reserve_once, range(24)))
    assert sum(successes) == 3, successes
    assert connection.execute('SELECT used FROM usage WHERE key=?', ('trial:a',)).fetchone()[0] == 3
    connection.execute('UPDATE usage SET used=MAX(0,used-1) WHERE key=?', ('trial:a',))
    connection.commit()
    assert reserve_once(0)
    assert not reserve_once(0)
    connection.execute('INSERT INTO challenges VALUES (?,?,?,?)', ('a','0xabc','nonce-message',9999999999999))
    consumed = connection.execute('DELETE FROM challenges WHERE user_id=? AND message=? RETURNING user_id', ('a','nonce-message')).fetchone()
    replayed = connection.execute('DELETE FROM challenges WHERE user_id=? AND message=? RETURNING user_id', ('a','nonce-message')).fetchone()
    assert consumed and replayed is None
    connection.execute('INSERT INTO conversations VALUES (?,?,?,?,?,?,?)', ('one','a','wallet-a','Private title','chat','[]',1))
    assert connection.execute('SELECT id FROM conversations WHERE owner=? AND wallet=?', ('a','wallet-a')).fetchone()
    assert connection.execute('SELECT id FROM conversations WHERE owner=? AND wallet=?', ('b','wallet-a')).fetchone() is None
    assert connection.execute('SELECT id FROM conversations WHERE owner=? AND wallet=?', ('a','wallet-b')).fetchone() is None
    connection.execute('DELETE FROM conversations WHERE id=? AND owner=? AND wallet=?', ('one','b','wallet-a'))
    assert connection.execute('SELECT COUNT(*) FROM conversations').fetchone()[0] == 1
    connection.execute('DELETE FROM conversations WHERE id=? AND owner=? AND wallet=?', ('one','a','wallet-a'))
    assert connection.execute('SELECT COUNT(*) FROM conversations').fetchone()[0] == 0
    connection.commit()

    # Saved-history writes: owner-scoped update, then capped insert in one statement.
    UPDATE = 'UPDATE conversations SET title=?,mode=?,messages=?,updated=? WHERE id=? AND owner=? AND wallet=? RETURNING id'
    INSERT = ('INSERT OR IGNORE INTO conversations (id,owner,wallet,title,mode,messages,updated) '
              'SELECT ?,?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM conversations WHERE owner=? AND wallet=?) < ? RETURNING id')
    def save(conv_id, owner, wallet, cap=3, path=dbpath):
        with sqlite3.connect(path, timeout=10) as db:
            if db.execute(UPDATE, ('t', 'chat', '[]', 2, conv_id, owner, wallet)).fetchone():
                return 'updated'
            if db.execute(INSERT, (conv_id, owner, wallet, 't', 'chat', '[]', 1, owner, wallet, cap)).fetchone():
                return 'inserted'
            return 'denied' if db.execute('SELECT 1 FROM conversations WHERE id=?', (conv_id,)).fetchone() else 'full'
    assert save('c1', 'a', 'wallet-a') == 'inserted'
    assert save('c1', 'a', 'wallet-a') == 'updated'
    assert save('c1', 'b', 'wallet-b') == 'denied'
    assert save('c1', 'a', 'wallet-b') == 'denied'
    connection.execute('DELETE FROM conversations')
    connection.commit()
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
        results = list(pool.map(lambda i: save('race-%d' % i, 'a', 'wallet-a'), range(24)))
    assert results.count('inserted') == 3 and results.count('full') == 21, results
    assert connection.execute('SELECT COUNT(*) FROM conversations').fetchone()[0] == 3
    print('PASS: owner-scoped history updates and atomic 100-conversation cap (tested at 3 under concurrency).')
    print('PASS: concurrent quota enforcement, failed-request refund, challenge replay prevention, cross-account and cross-wallet history isolation, authorized deletion.')
