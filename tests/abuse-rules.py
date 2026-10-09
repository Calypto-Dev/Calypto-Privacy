"""Exercise the actual production SQL with real SQLite concurrency."""
import concurrent.futures
import pathlib
import re
import sqlite3
import tempfile

guards = pathlib.Path('lib/guards.ts').read_text()
route = pathlib.Path('app/api/[...path]/route.ts').read_text()
RATE = re.search(r'RATE_SQL = `([^`]+)`', guards).group(1)
LEASE = re.search(r'LEASE_SQL = `([^`]+)`', guards).group(1)
INSERT = re.search(r'"(INSERT OR IGNORE INTO conversations [^"\n]+)"', route).group(1)
UPDATE = re.search(r'"(UPDATE conversations SET [^"\n]+)"', route).group(1)
with tempfile.TemporaryDirectory() as temp:
    dbpath = pathlib.Path(temp) / 'abuse.sqlite'
    con = sqlite3.connect(dbpath)
    for migration in sorted(pathlib.Path('drizzle').glob('*.sql')):
        con.executescript(migration.read_text())
    def counter(_):
        with sqlite3.connect(dbpath, timeout=10) as db:
            return db.execute(RATE, ('ip:a', 2000, 1000, 1000, 1000, 12)).fetchone() is not None
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
        assert sum(pool.map(counter, range(48))) == 12
    assert not counter(0)
    assert con.execute(RATE, ('ip:a', 4000, 2000, 2000, 2000, 12)).fetchone()[0] == 1
    con.commit()
    def acquire(i):
        with sqlite3.connect(dbpath, timeout=10) as db:
            return db.execute(LEASE, ('chat:wallet', str(i), 2000, 1000)).fetchone()
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
        winners = [r for r in pool.map(acquire, range(24)) if r]
    assert len(winners) == 1
    old = winners[0][0]
    assert con.execute(LEASE, ('chat:wallet', 'new', 4000, 2000)).fetchone()
    # Late completion cannot release a lease owned by a newer request.
    con.execute('DELETE FROM request_leases WHERE key=? AND token=?', ('chat:wallet', old))
    assert con.execute('SELECT token FROM request_leases').fetchone()[0] == 'new'
    con.execute('DELETE FROM request_leases WHERE key=? AND token=?', ('chat:wallet', 'new'))
    assert con.execute('SELECT token FROM request_leases').fetchone() is None
    con.commit()
    def save(conv_id, owner, wallet, content='[]', cap=3):
        with sqlite3.connect(dbpath, timeout=10) as db:
            byte_count = len(content.encode())
            if db.execute(UPDATE, ('t','chat',content,1,conv_id,owner,wallet,wallet,conv_id,byte_count)).fetchone():
                return 'updated'
            return 'inserted' if db.execute(INSERT, (conv_id,owner,wallet,'t','chat',content,1,wallet,cap,wallet,byte_count)).fetchone() else 'denied'
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
        results = list(pool.map(lambda i: save(str(i), 'a' if i % 2 else 'b', 'same-wallet'), range(24)))
    assert results.count('inserted') == 3  # Wallet cap spans different visitor cookies.
    own_id, owner = con.execute('SELECT id,owner FROM conversations LIMIT 1').fetchone()
    assert save(own_id, 'stranger', 'same-wallet') == 'denied'
    assert save(own_id, owner, 'different-wallet') == 'denied'
    assert save(own_id, owner, 'same-wallet') == 'updated'
    con.execute('DELETE FROM conversations')
    # Existing history counts towards the byte cap; Unicode is measured in bytes.
    con.execute('INSERT INTO conversations VALUES (?,?,?,?,?,?,?)', ('large','a','wallet','t','chat','🙂' * 524280,1))
    con.commit()
    assert save('fits','b','wallet','x' * 32,100) == 'inserted'
    assert save('overflow','c','wallet','x',100) == 'denied'
    assert save('fits','b','wallet','x' * 33,100) == 'denied'
    assert save('fits','b','wallet','x' * 8,100) == 'updated'
    con.execute('DELETE FROM conversations')
    con.executemany('INSERT INTO conversations VALUES (?,?,?,?,?,?,?)', [(str(i),'a','wallet-'+str(i),'t','chat','[]',1) for i in range(1000)])
    con.commit()
    assert save('global-overflow','b','fresh-wallet',cap=100) == 'denied'
    print('PASS: concurrent IP limits, window expiry, concurrent leases, token-scoped release, cross-session wallet storage caps, byte limits and site-wide history cap.')
