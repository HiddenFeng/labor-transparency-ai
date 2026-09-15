"""Admin-only local research controls. No network operation from public GETs."""
import secrets
from fastapi import Request
from pydantic import BaseModel,ConfigDict,Field
from .core import digest

class Model(BaseModel):model_config=ConfigDict(extra='forbid')
class RunInput(Model):
    allow_network:bool=False
    max_jobs:int=Field(default=3,ge=1,le=20)
    include_current:bool=False
class BindInput(Model):
    lei:str=Field(min_length=20,max_length=24)
    reason:str=Field(min_length=8,max_length=1500)
class BindSourceInput(Model):
    provider:str=Field(min_length=2,max_length=40)
    external_id:str=Field(min_length=1,max_length=300)
    reason:str=Field(min_length=8,max_length=1500)
class ReviewInput(Model):
    expected_hash:str=Field(min_length=64,max_length=64)
    reason:str=Field(min_length=8,max_length=1500)
    checks:dict[str,bool]
class ReopenInput(Model):reason:str=Field(min_length=8,max_length=1500)

def install_research(app,store,admin_token):
    def operator(request):
        provided=request.headers.get('authorization','')
        if not admin_token or not secrets.compare_digest(provided,'Bearer '+admin_token):
            raise PermissionError('研究队列和复核需要本地运营权限')
        return 'local-operator:'+digest(admin_token)[:12]

    @app.get('/api/admin/research')
    def queue(request:Request):
        operator(request)
        return {'tasks':store.task_list(),'network_enabled':app.state.research_network,
                'source':'MULTI_SOURCE: GLEIF identity root + bound SEC/Wikidata/NLRB/OSHA enrichers; unresolved matches stay candidates',
                'source_registry':store.source_registry(),'scheduler':store.scheduler_status()}

    @app.get('/api/admin/research/health')
    def health(request:Request):
        operator(request)
        return store.scheduler_status()

    @app.post('/api/admin/research/run')
    def run(body:RunInput,request:Request):
        operator(request)
        if not app.state.research_network:raise PermissionError('运行环境尚未开启公开来源网络研究')
        if not body.allow_network:raise PermissionError('请明确确认本次有限公开来源查询')
        return store.run_research(allow_network=True,max_jobs=body.max_jobs,
                 include_current=body.include_current,client_factory=app.state.research_client_factory)

    @app.post('/api/admin/research/runs/{run_id}/bind')
    def bind(run_id:str,body:BindInput,request:Request):
        who=operator(request)
        return store.bind_identity(run_id,body.lei,who,body.reason)

    @app.post('/api/admin/research/runs/{run_id}/bind-source')
    def bind_source(run_id:str,body:BindSourceInput,request:Request):
        who=operator(request)
        return store.bind_external_source(run_id,body.provider,body.external_id,who,body.reason)

    @app.post('/api/admin/research/runs/{run_id}/approve')
    def approve(run_id:str,body:ReviewInput,request:Request):
        who=operator(request)
        return store.review_research(run_id,body.expected_hash,who,body.reason,body.checks)

    @app.post('/api/admin/research/jobs/{job_id}/reopen')
    def reopen(job_id:str,body:ReopenInput,request:Request):
        who=operator(request)
        return store.reopen_research(job_id,who,body.reason)
