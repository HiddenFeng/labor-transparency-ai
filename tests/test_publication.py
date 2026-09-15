import copy,hashlib,json,tempfile,unittest
from pathlib import Path
from app.community import KINDS,LICENSE_ID
from app.publication import snapshot_files,write_snapshot,csv_value,validate_dataset

def fixture():
    row={'id':'con_example','version':1,'company_id':'co_example','company_name':'虚构工厂','region':'虚构地区','synthetic':True,'title':'虚构产品记录','description':'合成测试数据','scope':'虚构厂区','period_start':'2026-01-01','period_end':'2026-12-31','dimension':'other','direction':'neutral','relation':'制造','category':'测试产品','product_id':'','evidence':'E3','credit':'匿名贡献者','sources':[{'url':'https://example.org/testing','title':'虚构出处','type':'company_disclosure','published_at':'2026-01-01','supports':'仅演示证据来源字段'}],'license':LICENSE_ID}
    data={'schema_version':'0.4','license':LICENSE_ID,'purpose':'仅非商业公益用途','generated_at':'2026-09-14T00:00:00+00:00','categories':{k:[] for k in KINDS},'record_count':1,'withdrawal_notice':'下载副本不能保证回收'}
    data['categories']['product']=[row];return data
class PublicationTests(unittest.TestCase):
    def test_categories_and_manifest(self):
        f=snapshot_files(fixture());m=json.loads(f['manifest.json']);self.assertEqual(len(f),15)
        for n,h in m['files'].items():self.assertEqual(hashlib.sha256(f[n]).hexdigest(),h)
    def test_reproducible(self):self.assertEqual(snapshot_files(fixture()),snapshot_files(fixture()))
    def test_extra_account_field_denied(self):
        d=fixture();d['categories']['product'][0]['owner']='secret'
        with self.assertRaises(ValueError):snapshot_files(d)
    def test_private_case_top_field_denied(self):
        d=fixture();d['cases']=[]
        with self.assertRaises(ValueError):snapshot_files(d)
    def test_phone_rejected(self):
        d=fixture();d['categories']['product'][0]['description']='电话13812345678'
        with self.assertRaises(ValueError):snapshot_files(d)
    def test_low_evidence_preserved_not_denied(self):
        d=fixture();row=d['categories']['product'][0];row.update(evidence='E0',scope='',period_start='',period_end='',sources=[])
        out=json.loads(snapshot_files(d)['dataset.json']);self.assertEqual(out['categories']['product'][0]['evidence'],'E0')
    def test_high_evidence_requires_sources_and_scope(self):
        for field,value in [('sources',[]),('scope',''),('period_start','')]:
            d=fixture();d['categories']['product'][0][field]=value
            with self.assertRaises(ValueError):snapshot_files(d)
    def test_unknown_evidence_grade_rejected(self):
        d=fixture();d['categories']['product'][0]['evidence']='E9'
        with self.assertRaises(ValueError):snapshot_files(d)
    def test_count_mismatch_denied(self):
        d=fixture();d['record_count']=5
        with self.assertRaises(ValueError):snapshot_files(d)
    def test_anonymized_tombstones(self):
        old=fixture();new=fixture();new['categories']['product']=[];new['record_count']=0
        files=snapshot_files(new,old);c=json.loads(files['changes.json'])
        self.assertEqual(c['stop_redistributing'],[{'id':'con_example','previous_version':1}]);self.assertNotIn('虚构工厂',files['changes.json'].decode())
    def test_update_explains_version(self):
        old=fixture();new=fixture();new['categories']['product'][0]['version']=2
        self.assertEqual(json.loads(snapshot_files(new,old)['changes.json'])['updated'],[{'id':'con_example','version':2}])
    def test_no_overwrite_output(self):
        with tempfile.TemporaryDirectory() as td:
            p=Path(td)/'release';write_snapshot(fixture(),p)
            with self.assertRaises(ValueError):write_snapshot(fixture(),p)
    def test_csv_formula_not_executable(self):
        self.assertEqual(csv_value('=SUM(1,2)'),"'=SUM(1,2)");self.assertEqual(csv_value('normal'),'normal')
    def test_contribution_credit_separate(self):
        c=json.loads(snapshot_files(fixture())['contributions.json'])[0]
        self.assertEqual(c['credit'],'匿名贡献者');self.assertIn('contribution',c);self.assertNotIn('owner',c)
    def test_incorrect_rights_cannot_pass(self):
        d=fixture();d['license']='MIT'
        with self.assertRaises(ValueError):validate_dataset(d)
    def test_empty_safe_snapshot_valid(self):
        d=fixture();d['categories']['product']=[];d['record_count']=0
        self.assertEqual(len(snapshot_files(d)),15)
    def test_internal_numeric_ids_are_structural_not_pii(self):
        d=fixture();row=d['categories']['product'][0]
        row['id']='con_1234567890123456abc';row['company_id']='co_1234567890123456abc'
        row['product_id']='con_9876543210987654def'
        self.assertIs(validate_dataset(d),d)
        row['product_id']='not-an-internal-id'
        with self.assertRaises(ValueError):validate_dataset(d)
if __name__=='__main__':unittest.main()
