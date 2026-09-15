"""Explicit synthetic fixtures. NEVER use this function with a real-data database."""
from .core import utcnow,iso
from .community import Store

def seed_community(store:Store):
    with store.db() as c:
        if c.execute('SELECT 1 FROM companies WHERE synthetic=0').fetchone():raise ValueError('数据库含非合成公司，拒绝运行演示填充')
        for role in ('synthetic-fact-review','synthetic-privacy-review'):
            c.execute('INSERT OR IGNORE INTO review_roles VALUES (?,?)',(role,iso(utcnow())))
    store.set_phase('assistance')
    examples=[('青禾制造（虚构）','连接器','电子部件','positive'),('远山设备（虚构）','便携工作台','工具设备','negative'),('清流照明（虚构）','桌面灯具','家居用品','positive')]
    result=[]
    for index,(name,product,category,direction) in enumerate(examples):
        owner='synthetic-contributor-'+str(index)
        receipt=store.register(owner,{'name':name,'region':'演示地区','needs':['company','products'],'public':True,'consent':True,'synthetic':True},'community-demo-company-'+str(index))
        cid=receipt['company_id']
        base={'company_id':cid,'kind':'product','title':product+'（虚构）','description':'本条是合成演示；关联和评价不代表任何现实公司或产品。','category':category,'relation':'示例品牌或制造关系','public':True,'consent':True,'share_consent':False,'rights':'own_summary','sources':[]}
        pid=store.contribute_many(owner,[base])[0]['id']
        for voter in range(3):store.ballot(cid,'synthetic-voter-'+str(voter),direction)
        if index in (0,2):
            claim={**base,'kind':'labour_claim','title':'特定厂区的休息安排（合成演示）','description':'软件流程演示：假设在注明期间的厂区内按约定安排休息。未调查任何真实劳动者。','direction':'positive','dimension':'rest','scope':'仅虚构演示厂区','period_start':'2026-01-01','period_end':'2099-12-31','share_consent':True,'sources':[{'url':'https://example.org/synthetic-fixture','title':'合成测试出处','type':'company_disclosure','supports':'仅验证来源字段；不作为现实证据'}]}
            rid=store.contribute_many(owner,[claim])[0]['id']
            store.review_contribution(rid,'synthetic-fact-review',1,'approve','E3','合成演示核验记录，不代表真实调查或核实结果。',{'scope_checked':True,'authenticity_checked':True,'source_ids':['S1']})
            store.approve_export(rid,'synthetic-privacy-review',1,True,True,'本项仅用于演示安全再分发软件流程，全部为合成数据。')
        result.append({'company_id':cid,'product_id':pid})
    return {'mode':'SYNTHETIC_ONLY','companies':result,'notes':'本地演示包含模拟核验，不能当作已核实的现实信息。不创建任何调度或外部提交。'}
