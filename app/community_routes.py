"""Community API routes. Operator tokens grant roles, never impersonate reviewers."""
import secrets
from typing import Literal
from fastapi import Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field

class Model(BaseModel):
    model_config=ConfigDict(extra='forbid')
class Source(Model):
    url:str=Field(max_length=500)
    title:str=Field(min_length=2,max_length=200)
    type:Literal['first_person','company_disclosure','public_record','official_decision','other']='other'
    published_at:str=''
    supports:str=Field(min_length=2,max_length=1000)
class Contribution(Model):
    company_id:str
    kind:Literal['product','company_fact','relationship','labour_claim','product_claim']
    title:str=Field(min_length=2,max_length=120)
    description:str=Field(min_length=2,max_length=2000)
    scope:str=Field(default='',max_length=300)
    period_start:str=''
    period_end:str=''
    direction:Literal['neutral','positive','negative']='neutral'
    dimension:Literal['pay','rest','hours','safety','contract','respect','representation','other']='other'
    product_id:str=''
    relation:str=Field(default='',max_length=80)
    category:str=Field(default='',max_length=80)
    sources:list[Source]=Field(default_factory=list,max_length=10)
    public:bool=False
    consent:bool=False
    share_consent:bool=False
    rights:Literal['own_summary','permission','public_domain','reference_only']='reference_only'
    rights_note:str=Field(default='',max_length=500)
    credit_name:str=Field(default='',max_length=40)
class Batch(Model):
    items:list[Contribution]=Field(min_length=1,max_length=50)
class Revision(Model):
    version:int=Field(ge=1)
    contribution:Contribution
class Checks(Model):
    scope_checked:bool=False
    authenticity_checked:bool=False
    source_ids:list[str]=Field(default_factory=list,max_length=10)
    decision_reference:str=Field(default='',max_length=200)
    effective:bool=False
class Review(Model):
    version:int=Field(ge=1)
    decision:Literal['approve','reject','dispute','reopen']
    evidence:Literal['E0','E1','E2','E3','E4','E5']='E0'
    rationale:str=Field(min_length=8,max_length=1000)
    checks:Checks=Field(default_factory=Checks)
class ExportApproval(Model):
    version:int=Field(ge=1)
    privacy_checked:bool=False
    rights_checked:bool=False
    reason:str=Field(min_length=8,max_length=1000)
class Flag(Model):
    reason:str=Field(min_length=5,max_length=1000)
class Role(Model):
    username:str=Field(min_length=2,max_length=32)
    active:bool=True

def install_community(app,store,admin_token):
    @app.get('/api/showcase')
    def showcase(request:Request,lane:str='community_positive',q:str='',days:int=7):
        return store.showcase(request.state.owner,lane,q,days)
    @app.get('/api/contributions')
    def contributions(request:Request,company_id:str='',mine:bool=False,kind:str=''):
        return store.contributions(request.state.owner,company_id,mine,kind)
    @app.post('/api/contributions')
    def contribute(body:Contribution,request:Request):
        return store.contribute_many(request.state.owner,[body.model_dump()])[0]
    @app.post('/api/contributions/batch')
    def batch(body:Batch,request:Request):
        return {'items':store.contribute_many(request.state.owner,[x.model_dump() for x in body.items])}
    @app.get('/api/contributions/{cid}')
    def detail(cid:str,request:Request):return store.contribution(cid,request.state.owner)
    @app.post('/api/contributions/{cid}/revise')
    def revise(cid:str,body:Revision,request:Request):
        return store.revise_contribution(cid,request.state.owner,body.contribution.model_dump(),body.version)
    @app.post('/api/contributions/{cid}/withdraw')
    def withdraw(cid:str,request:Request):
        store.withdraw_contribution(cid,request.state.owner);return {'withdrawn':True}
    @app.post('/api/contributions/{cid}/flag')
    def flag(cid:str,body:Flag,request:Request):return store.flag_contribution(cid,request.state.owner,body.reason)
    @app.get('/api/review-role')
    def role(request:Request):return {'can_review':store.can_review(request.state.owner)}
    @app.get('/api/review-queue')
    def queue(request:Request):return store.review_queue(request.state.owner)
    @app.post('/api/contributions/{cid}/review')
    def review(cid:str,body:Review,request:Request):
        return store.review_contribution(cid,request.state.owner,body.version,body.decision,body.evidence,body.rationale,body.checks.model_dump())
    @app.post('/api/contributions/{cid}/approve-export')
    def export(cid:str,body:ExportApproval,request:Request):
        return store.approve_export(cid,request.state.owner,body.version,body.privacy_checked,body.rights_checked,body.reason)
    @app.get('/api/public-data')
    def dataset():return store.safe_dataset()
    @app.get('/api/public-data/download')
    def download():
        return JSONResponse(store.safe_dataset(),headers={'Content-Disposition':'attachment; filename="ltp-public-interest-data.json"'})
    @app.post('/api/admin/reviewers')
    def grant(body:Role,request:Request):
        if not admin_token or not secrets.compare_digest(request.headers.get('authorization',''),'Bearer '+admin_token):
            raise PermissionError('需运营凭据才能授权核验员')
        store.grant_reviewer(body.username,body.active);return {'updated':True}
