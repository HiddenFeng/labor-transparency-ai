"""Build a reproducible, allowlisted public snapshot. Never accepts a database.

Review and consent are performed upstream. Validation here cannot guarantee
anonymity or verify facts; it prevents accidental raw-database publication.
"""
from __future__ import annotations
import csv, hashlib, io, json, re
from datetime import datetime
from pathlib import Path
from .community import LICENSE_ID, KINDS, clean, source_url, date_value, SOURCE_TYPES

FIELDS={'id','version','company_id','company_name','region','synthetic','title','description','scope','period_start','period_end','dimension','direction','relation','category','product_id','evidence','credit','sources','license'}
TOP={'schema_version','license','purpose','generated_at','categories','record_count','withdrawal_notice'}
SOURCE={'url','title','type','published_at','supports'}

def canonical(value):return (json.dumps(value,ensure_ascii=False,sort_keys=True,indent=2)+'\n').encode('utf-8')
def validate_dataset(data):
    if not isinstance(data,dict) or set(data)!=TOP:raise ValueError('需要/api/public-data的精确白名单结构，不接受原始数据库或额外字段')
    if data['license']!=LICENSE_ID or data['schema_version']!='0.4':raise ValueError('许可或数据结构版本不匹配')
    if not isinstance(data['categories'],dict) or set(data['categories'])!=KINDS:raise ValueError('分类不完整或出现未批准分类')
    datetime.fromisoformat(data['generated_at'].replace('Z','+00:00'))
    identifiers=set();count=0
    for kind,items in data['categories'].items():
        if not isinstance(items,list):raise ValueError('分类必须为数组')
        for item in items:
            if not isinstance(item,dict) or set(item)!=FIELDS:raise ValueError('数据行存在非公开字段或缺失字段')
            if item['license']!=LICENSE_ID or item['evidence'] not in {'E0','E1','E2','E3','E4','E5'}:raise ValueError('证据状态无效或许可不匹配')
            if type(item['version']) is not int or item['version']<1 or type(item['synthetic']) is not bool:raise ValueError('版本或示例标记无效')
            if not re.fullmatch(r'con_[a-z0-9]+',item['id']) or not re.fullmatch(r'co_[a-z0-9]+',item['company_id']):raise ValueError('标识格式不正确')
            if item['product_id'] and not re.fullmatch(r'con_[a-z0-9]+',item['product_id']):raise ValueError('产品标识格式不正确')
            if item['id'] in identifiers:raise ValueError('同一数据包不能出现重复记录ID')
            identifiers.add(item['id']);count+=1
            # Internal random identifiers are validated structurally above. Do not run the
            # public PII heuristic over them: a legitimate random id can contain a long
            # digit run and must not be mistaken for a phone/account number.
            for key in FIELDS-{'sources','synthetic','version','id','company_id','product_id'}:
                if not isinstance(item[key],str):raise ValueError('文本字段类型无效')
                clean(item[key],0,3000)
            if int(item['evidence'][1])>=3 and not item['scope']:raise ValueError('高证据记录缺少具体适用范围')
            start=date_value(item['period_start']);end=date_value(item['period_end'])
            if start and end and start>end:raise ValueError('日期范围无效')
            if int(item['evidence'][1])>=3 and (not start or not end):raise ValueError('高证据记录缺少日期范围')
            if not isinstance(item['sources'],list) or len(item['sources'])>10:raise ValueError('来源列表无效')
            if int(item['evidence'][1])>=2 and not item['sources']:raise ValueError('材料等级缺少支持来源')
            for source in item['sources']:
                if set(source)!=SOURCE:raise ValueError('来源含非公开字段')
                if source['type'] not in SOURCE_TYPES:raise ValueError('来源类型无效')
                source_url(source['url']);date_value(source['published_at'])
                for k in ('title','supports'):clean(source[k],2,1000)
    if type(data['record_count']) is not int or data['record_count']!=count:raise ValueError('记录数量与内容不一致')
    return data

def csv_value(value):
    text=json.dumps(value,ensure_ascii=False,sort_keys=True) if isinstance(value,(dict,list)) else str(value)
    # Spreadsheet formula-injection protection; JSON preserves original text.
    return "'"+text if text.lstrip().startswith(('=','+','-','@','\t','\r')) else text

def snapshot_files(data,previous=None):
    validate_dataset(data)
    if previous is not None:validate_dataset(previous)
    files={'dataset.json':canonical(data)}
    for kind in sorted(KINDS):
        rows=sorted(data['categories'][kind],key=lambda r:r['id'])
        files[kind+'.json']=canonical(rows)
        out=io.StringIO(newline='');writer=csv.DictWriter(out,fieldnames=sorted(FIELDS),lineterminator='\n');writer.writeheader()
        for row in rows:writer.writerow({k:csv_value(v) for k,v in row.items()})
        files[kind+'.csv']=out.getvalue().encode('utf-8-sig')
    old={r['id']:r for rs in previous['categories'].values() for r in rs} if previous else {}
    new={r['id']:r for rs in data['categories'].values() for r in rs}
    changes={'schema_version':'0.4','added':sorted(set(new)-set(old)),
             'updated':[{'id':i,'version':new[i]['version']} for i in sorted(set(old)&set(new)) if old[i]!=new[i]],
             'stop_redistributing':[{'id':i,'previous_version':old[i]['version']} for i in sorted(set(old)-set(new))],
             'note':'停止再分发仅标记该记录不在当前安全快照中，不公开撤回原因或原文。'}
    files['changes.json']=canonical(changes)
    contributions=[{'record_id':r['id'],'version':r['version'],'category':k,'credit':r['credit'],'contribution':r['title'],'scope':r['scope'],'evidence':r['evidence']} for k,rows in sorted(data['categories'].items()) for r in rows]
    files['contributions.json']=canonical(contributions)
    files['README.txt']=('劳动透明计划公益数据快照\n'+data['purpose']+'\n仅包含独立授权、证据状态评估和安全复核后的结构化摘要。E0仍表示未经独立核实，不因可再分发而升级。\n不存在员工总体代表性保证。synthetic=true为虚构测试。\n引用链接不转授原文、商标、个人信息权利。请参照LICENSE与LICENSE-DATA.md。\n'+data['withdrawal_notice']+'\n').encode('utf-8')
    files['manifest.json']=canonical({'schema_version':'0.4','license':LICENSE_ID,'source_generated_at':data['generated_at'],'record_count':data['record_count'],
      'files':{name:hashlib.sha256(content).hexdigest() for name,content in sorted(files.items())}})
    return files

def write_snapshot(data,out,previous=None):
    files=snapshot_files(data,previous);out=Path(out)
    if out.exists() and any(out.iterdir()):raise ValueError('输出目录必须为空，避免覆盖历史快照或其他文件')
    out.mkdir(parents=True,exist_ok=True)
    for name,content in files.items():(out/name).write_bytes(content)
    return {'files':len(files),'record_count':data['record_count'],'path':str(out)}
