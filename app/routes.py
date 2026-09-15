"""Additional local API routes; all public/private projections are explicit."""
from __future__ import annotations
import io
import json
import secrets
import zipfile
from typing import Optional
from urllib.parse import quote
from fastapi import Request, Response
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, ConfigDict
from .platform import PHASE_NAMES

class Model(BaseModel):
    model_config=ConfigDict(extra='forbid')
class AccountInput(Model):
    username:str=Field(min_length=2,max_length=32)
    password:str=Field(min_length=1,max_length=128)
class CommentInput(Model):
    body:str=Field(min_length=2,max_length=2000)
class BallotInput(Model):
    direction:str
class FollowInput(Model):
    active:bool=True
class ConditionInput(Model):
    period:str=Field(min_length=1,max_length=40)
    role:str=Field(default='',max_length=40)
    rest:str='unknown'
    weekly_hours:Optional[float]=None
    advertised_pay:Optional[float]=None
    actual_pay:Optional[float]=None
    advertised_basis:str='unknown'
    actual_basis:str='unknown'
    currency:str='CNY'
    note:str=Field(default='',max_length=500)
class CaseInput(Model):
    title:str=Field(min_length=2,max_length=100)
    facts:str=Field(min_length=2,max_length=8000)
    goal:str=Field(min_length=2,max_length=1000)
class CaseEventInput(Model):
    status:str
    note:str=Field(min_length=2,max_length=2000)
class EvidenceInput(Model):
    claim:str=Field(min_length=2,max_length=500)
    filename:str=Field(min_length=1,max_length=120)
    content_b64:str=Field(max_length=2800000)
class SummaryInput(Model):
    summary:str=Field(min_length=2,max_length=1500)
    consent:bool=False
class ReportInput(Model):
    reason:str
    detail:str=Field(min_length=2,max_length=2000)
class RepresentationInput(Model):
    explanation:str=Field(min_length=5,max_length=2000)
class ResponseInput(Model):
    body:str=Field(min_length=2,max_length=3000)
class DeleteInput(Model):
    confirm:bool=False
class PhaseInput(Model):
    phase:str
class ModerateInput(Model):
    action:str
    reason:str=Field(min_length=5,max_length=1000)
class ApproveInput(Model):
    reason:str=Field(min_length=5,max_length=1000)
class PrepareInput(Model):
    company_id:str
    batch_day:str
    packet:dict


def install(app,store,admin_token):
    def administrator(request):
        provided=request.headers.get('authorization','')
        expected='Bearer '+admin_token if admin_token else ''
        if not expected or not secrets.compare_digest(provided,expected):
            raise PermissionError('此入口仅供项目运营；请使用本地启动时生成的管理凭据')

    @app.exception_handler(PermissionError)
    async def forbidden(req,exc):
        return JSONResponse({'error':str(exc)},status_code=403)

    @app.get('/api/account')
    def account(request:Request):return store.account(request.state.owner)

    @app.post('/api/account/signup')
    def signup(body:AccountInput,request:Request):
        request.state.rotated_token=store.signup(request.state.owner,body.username,body.password,request.state.token)
        return {'signed_in':True,'username':body.username}

    @app.post('/api/account/login')
    def login(body:AccountInput,request:Request):
        request.state.rotated_token=store.login(request.state.owner,body.username,body.password,request.state.token)
        return {'signed_in':True,'username':body.username}

    @app.post('/api/account/logout')
    def logout(request:Request):
        store.logout(request.state.token)
        request.state.rotated_token=store.resolve_session(None)[0]
        return {'signed_in':False}

    @app.get('/api/account/export')
    def export_account(request:Request):
        data=store.export_account(request.state.owner)
        buffer=io.BytesIO()
        with zipfile.ZipFile(buffer,'w',zipfile.ZIP_DEFLATED) as z:
            z.writestr('my-data.json',json.dumps(data,ensure_ascii=False,indent=2))
            for case in data['private_cases']:
                z.writestr('cases/'+case['id']+'/statement.txt',store.material(case['id'],request.state.owner))
                for evidence in case['evidence']:
                    raw,filename=store.evidence_file(evidence['id'],request.state.owner)
                    z.writestr('cases/'+case['id']+'/'+evidence['id']+'/'+filename,raw)
        return Response(buffer.getvalue(),media_type='application/zip',headers={'Content-Disposition':'attachment; filename="my-private-data.zip"'})

    @app.post('/api/account/delete')
    def delete_account(body:DeleteInput,request:Request):
        if not body.confirm:raise ValueError('请先确认是否导出并删除自己的数据')
        store.delete_account(request.state.owner,request.state.token)
        request.state.rotated_token=store.resolve_session(None)[0]
        return {'deleted':True}

    @app.get('/api/dashboard')
    def dashboard(request:Request):return store.dashboard(request.state.owner)

    @app.get('/api/feed')
    def feed(request:Request,tone:str='',urgent:bool=False):return store.feed(request.state.owner,tone,urgent)

    @app.get('/api/posts/{pid}')
    def post_detail(pid:str,request:Request):return store.post_detail(pid,request.state.owner)

    @app.post('/api/posts/{pid}/comments')
    def comment(pid:str,body:CommentInput,request:Request):return store.comment(pid,request.state.owner,body.body)

    @app.post('/api/posts/{pid}/withdraw')
    def withdraw(pid:str,request:Request):
        store.delete_post(pid,request.state.owner);return {'withdrawn':True}

    @app.post('/api/posts/{pid}/report')
    def report(pid:str,body:ReportInput,request:Request):return store.report(pid,request.state.owner,body.reason,body.detail)

    @app.get('/api/rankings')
    def rankings(request:Request,order:str='heat'):return store.rankings(request.state.owner,order)

    @app.post('/api/companies/{cid}/ballot')
    def ballot(cid:str,body:BallotInput,request:Request):return store.ballot(cid,request.state.owner,body.direction)

    @app.post('/api/companies/{cid}/follow')
    def follow(cid:str,body:FollowInput,request:Request):return store.follow(cid,request.state.owner,body.active)

    @app.get('/api/companies/{cid}/conditions')
    def conditions(cid:str,request:Request):return store.conditions_summary(cid,request.state.owner)

    @app.post('/api/companies/{cid}/conditions')
    def condition(cid:str,body:ConditionInput,request:Request):return store.save_condition(cid,request.state.owner,body.model_dump())

    @app.post('/api/companies/{cid}/cases')
    def new_case(cid:str,body:CaseInput,request:Request):return store.create_case(cid,request.state.owner,body.title,body.facts,body.goal)

    @app.get('/api/cases')
    def cases(request:Request):return store.cases(request.state.owner)

    @app.get('/api/cases/{kid}')
    def case(kid:str,request:Request):return store.case(kid,request.state.owner)

    @app.post('/api/cases/{kid}/events')
    def case_event(kid:str,body:CaseEventInput,request:Request):return store.update_case(kid,request.state.owner,body.status,body.note)

    @app.post('/api/cases/{kid}/evidence')
    def evidence(kid:str,body:EvidenceInput,request:Request):return store.add_evidence(kid,request.state.owner,body.claim,body.filename,body.content_b64)

    @app.get('/api/evidence/{eid}/download')
    def attachment(eid:str,request:Request):
        raw,filename=store.evidence_file(eid,request.state.owner)
        return Response(raw,media_type='application/octet-stream',headers={'Content-Disposition':"attachment; filename*=UTF-8''"+quote(filename,safe='')})

    @app.post('/api/evidence/{eid}/delete')
    def delete_evidence(eid:str,request:Request):
        store.delete_evidence(eid,request.state.owner);return {'deleted':True}

    @app.get('/api/cases/{kid}/material')
    def material(kid:str,request:Request):
        return Response(store.material(kid,request.state.owner),media_type='text/plain',headers={'Content-Disposition':'attachment; filename="statement.txt"'})

    @app.get('/api/cases/{kid}/export')
    def export(kid:str,request:Request):
        data=store.case(kid,request.state.owner)
        buffer=io.BytesIO()
        with zipfile.ZipFile(buffer,'w',zipfile.ZIP_DEFLATED) as z:
            z.writestr('statement.txt',store.material(kid,request.state.owner))
            z.writestr('case.json',json.dumps(data,ensure_ascii=False,indent=2))
            for e in data['evidence']:
                raw,filename=store.evidence_file(e['id'],request.state.owner)
                z.writestr('attachments/'+e['id']+'/'+filename,raw)
        return Response(buffer.getvalue(),media_type='application/zip',headers={'Content-Disposition':'attachment; filename="private-case.zip"'})

    @app.post('/api/cases/{kid}/public-summary')
    def summary(kid:str,body:SummaryInput,request:Request):return store.publish_summary(kid,request.state.owner,body.summary,body.consent)

    @app.post('/api/cases/{kid}/revoke-summary')
    def revoke_summary(kid:str,request:Request):
        store.revoke_summary(kid,request.state.owner);return {'public':False}

    @app.get('/api/companies/{cid}/public-summaries')
    def summaries(cid:str,request:Request):return store.summaries(cid,request.state.owner)

    @app.post('/api/companies/{cid}/representation')
    def representation(cid:str,body:RepresentationInput,request:Request):return store.representation(cid,request.state.owner,body.explanation)

    @app.get('/api/companies/{cid}/responses')
    def responses(cid:str,request:Request):return store.responses(cid,request.state.owner)

    @app.post('/api/companies/{cid}/responses')
    def response(cid:str,body:ResponseInput,request:Request):return store.response(cid,request.state.owner,body.body)

    @app.get('/api/admin')
    def admin(request:Request):
        administrator(request);return store.admin_dashboard()

    @app.post('/api/admin/phase')
    def phase(body:PhaseInput,request:Request):
        administrator(request);store.set_phase(body.phase);return {'phase':body.phase,'label':PHASE_NAMES[body.phase]}

    @app.post('/api/admin/reports/{rid}')
    def moderate(rid:str,body:ModerateInput,request:Request):
        administrator(request);return store.moderate(rid,body.action,body.reason)

    @app.post('/api/admin/representations/{rid}')
    def approve(rid:str,body:ApproveInput,request:Request):
        administrator(request);store.approve_representation(rid,body.reason);return {'approved':True}

    @app.post('/api/admin/prepare')
    def prepare(body:PrepareInput,request:Request):
        administrator(request);return {'digest':store.prepare(body.company_id,body.batch_day,body.packet)}

    @app.post('/api/admin/release')
    def release(request:Request):
        administrator(request);return {'released':store.release(),'clock':'REAL_CURRENT_TIME','external_research':False}
