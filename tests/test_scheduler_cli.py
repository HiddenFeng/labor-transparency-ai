import json,subprocess,sys,tempfile,time,unittest
from pathlib import Path
from app.research import Store

ROOT=Path(__file__).resolve().parents[1]

class SchedulerCLITests(unittest.TestCase):
    def test_once_records_heartbeat_without_network(self):
        with tempfile.TemporaryDirectory() as td:
            db=Path(td)/'state.sqlite3'
            p=subprocess.run([sys.executable,str(ROOT/'scripts/research_scheduler.py'),'--db',str(db),'--once','--interval-seconds','60'],
                             cwd=ROOT,text=True,capture_output=True,timeout=10)
            self.assertEqual(p.returncode,0,p.stderr)
            row=json.loads(p.stdout.strip().splitlines()[-1]);self.assertTrue(row['ok']);self.assertFalse(row['research']['network_authorized'])
            status=Store(db).scheduler_status();self.assertEqual(status['worker']['mode'],'RELEASE_ONLY')

    def test_loop_stops_cleanly_on_terminate(self):
        with tempfile.TemporaryDirectory() as td:
            db=Path(td)/'state.sqlite3'
            p=subprocess.Popen([sys.executable,str(ROOT/'scripts/research_scheduler.py'),'--db',str(db),'--loop','--interval-seconds','60'],
                               cwd=ROOT,text=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
            line=p.stdout.readline().strip();self.assertTrue(json.loads(line)['ok'])
            p.terminate();out,err=p.communicate(timeout=5);self.assertEqual(p.returncode,0,err)

    def test_invalid_interval_fails_before_loop(self):
        with tempfile.TemporaryDirectory() as td:
            p=subprocess.run([sys.executable,str(ROOT/'scripts/research_scheduler.py'),'--db',str(Path(td)/'x.sqlite3'),'--once','--interval-seconds','10'],
                             cwd=ROOT,text=True,capture_output=True,timeout=10)
            self.assertNotEqual(p.returncode,0);self.assertIn('60..3600',p.stderr+p.stdout)

if __name__=='__main__':unittest.main()
