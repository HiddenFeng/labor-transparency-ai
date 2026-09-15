export const ISSUE_GUIDES = [
  {
    id: 'pay',
    title: '工资少了，或加班没算清',
    short: '工资 / 加班',
    feeling: '“我明明干了这些时间，为什么账上不是这样？”',
    intro: '先别急着证明谁对谁错。把班次、工资单、通知和实际收到的钱按时间排好，很多问题会先从“账对不上”变成可核对的事实。',
    steps: ['记下日期、班次、工时和实际到账金额', '保留你合法持有的工资单、排班、通知与沟通记录', '查当地工资/工时主管机构的投诉时限与适用规则'],
    resourceTags: ['pay', 'hours']
  },
  {
    id: 'hours',
    title: '班排得喘不过气，休息总被打断',
    short: '工时 / 休息',
    feeling: '“是不是只有我觉得这样不正常？”',
    intro: '休息、工时和加班规则因地区不同，但“先把实际发生的时间记下来”几乎总是有用。不要只凭回忆，尽量形成连续记录。',
    steps: ['连续记录实际上下班、休息与临时加班时间', '区分“公司说的安排”和“你实际做了什么”', '遇到健康或即时安全风险时，优先使用当地正式渠道'],
    resourceTags: ['hours', 'safety']
  },
  {
    id: 'contract',
    title: '合同变了、岗位变了，或离职让我不安',
    short: '合同 / 离职',
    feeling: '“我不知道现在签字，会不会以后更被动。”',
    intro: '合同、解除、调岗和赔偿通常最怕“时间线混在一起”。先把旧版本、新通知、口头说明和你收到的最终文件分开。',
    steps: ['保留各版本合同、通知和关键日期', '把书面约定与口头说明分开记录', '临近签字、申诉或法定时限时，优先咨询当地工会、律师或正式机构'],
    resourceTags: ['contract', 'union']
  },
  {
    id: 'safety',
    title: '工作环境让我担心受伤或生病',
    short: '安全 / 工伤',
    feeling: '“我不想拿安全去赌，也不想因为发声被针对。”',
    intro: '安全问题要把“危险是什么、何时发生、谁知道、是否已经报告”说清楚。若存在迫在眉睫的人身危险，不要等待本站处理。',
    steps: ['记录危险位置、时间、设备或暴露情形', '保存你有权取得的安全通知、培训或报告记录', '如有即时危险，直接联系当地紧急服务或安全监管机构'],
    resourceTags: ['safety', 'retaliation']
  },
  {
    id: 'respect',
    title: '被羞辱、歧视、骚扰，或长期被不公平对待',
    short: '尊重 / 歧视',
    feeling: '“我很难受，但又怕自己说不清楚。”',
    intro: '先把“发生了什么”与“你怎么理解它”分开记录。具体日期、原话、在场人员和后续影响，往往比抽象评价更容易被理解。',
    steps: ['按时间记录具体行为、原话与在场情形', '避免公开发布他人的私人信息，先做私下事实整理', '查询当地反歧视、工会、劳动监察或法律援助渠道'],
    resourceTags: ['discrimination', 'union']
  },
  {
    id: 'voice',
    title: '想和同事一起发声，又担心被报复',
    short: '组织 / 发声',
    feeling: '“我想做点什么，但不想一个人扛。”',
    intro: '集体发声和工会权利在不同司法辖区规则不同。先了解你所在地区的组织权、反报复保护和正式申诉入口，再决定下一步。',
    steps: ['记录与集体沟通、组织或报复相关的时间线', '优先联系可信的工会、劳工组织或官方劳动关系机构', '不要把同事姓名、联系方式或组织计划发布到本站公共区域'],
    resourceTags: ['union', 'retaliation']
  }
];

export const RIGHTS_PRIMER = [
  {title:'你不需要先懂法律',body:'先把事实、时间和你最想解决的问题说清楚。本站的匿名辅导可以帮你整理下一步，但不会替代律师、工会、法院或监管机构。'},
  {title:'证据不是“越多越好”',body:'重要的是来源、范围和它到底能证明什么。聊天记录、工资单、公开文件、正式决定各自支持的结论不同，不能混在一起。'},
  {title:'发声不等于必须公开身份',body:'你可以先做匿名、非敏感的事实整理。若后续需要正式申诉，再根据当地规则向真正有权限的机构提供必要信息。'}
];

export const PUBLIC_CASES = [
  {
    id:'dol-urgent-care-2026',
    date:'2026-08-10',
    region:'美国 · Georgia',
    topic:'工资 / 加班 / 报复',
    title:'强制培训、会议也可能属于应付薪工时',
    summary:'美国劳工部称，一家 urgent care 雇主因未支付强制入职培训、会议等工时以及相关加班工资，被追缴 113,199 美元欠薪；调查还发现一名质疑薪酬做法的员工遭到停职。',
    takeaway:'如果争议围绕“这段时间算不算工作”，先记录谁要求你参加、持续多久、是否必须到场，以及它是否发生在正常班次之外。',
    source:'U.S. Department of Labor · Wage and Hour Division',
    url:'https://www.dol.gov/newsroom/releases/whd/whd20260810'
  },
  {
    id:'dol-overtime-bonus-2026',
    date:'2026-06-23',
    region:'美国 · Tennessee',
    topic:'加班 / 奖金',
    title:'加班费算错，问题可能藏在“计算方式”里',
    summary:'美国劳工部宣布为 1,666 名小时工追回约 173 万美元欠薪，原因之一是雇主在计算加班工资时未把相关激励奖金计入 regular rate。',
    takeaway:'当你觉得“公司有付加班，但金额总不对”，除了工时本身，也要保留奖金、补贴、绩效等构成工资的记录。',
    source:'U.S. Department of Labor · Wage and Hour Division',
    url:'https://www.dol.gov/newsroom/releases/whd/whd20260623'
  },
  {
    id:'wrc-golden-refit-2026',
    date:'2026-09-02',
    region:'孟加拉国 · Gazipur',
    topic:'骚扰 / 未付工时 / 救济',
    title:'公开调查真正有价值的，不只是“曝光”，而是能否得到补救',
    summary:'Worker Rights Consortium 的 Golden Refit 调查记录了针对女工的羞辱、威胁与未支付的 off-the-clock work；其后续更新称，相关管理人员被处理、工厂结束了未付工时做法，并同意提供补发工资与建立独立申诉机制等补救。',
    takeaway:'记录问题时，不只写“发生了不公”，也写清你希望获得什么补救：停止行为、补发工资、恢复岗位、改进安全、建立申诉机制等。',
    source:'Worker Rights Consortium',
    url:'https://www.workersrights.org/our-work/factory-investigations/golden-refit/'
  },
  {
    id:'wrc-wah-sun-2026',
    date:'2026-07-09',
    region:'柬埔寨',
    topic:'工会 / 报复 / 恢复岗位',
    title:'担心“发声会不会被报复”，是一个真实存在的问题',
    summary:'Worker Rights Consortium 的 Wah Sun HK Factory 调查称，工人在尝试组建独立工会后遭遇解雇、威胁和干预；后续补救包括恢复岗位、补发工资并停止相关报复与阻挠。',
    takeaway:'涉及组织、集体行动或报复时，尽量保留事件时间线，并优先寻找当地工会、劳动关系机构或法律援助，而不是独自公开对抗。',
    source:'Worker Rights Consortium',
    url:'https://www.workersrights.org/our-work/factory-investigations/wah-sun-hk-factory-cambodia/'
  }
];

export const RESOURCE_GROUPS = [
  {
    id:'global',
    label:'国际 / 全球',
    items:[
      {name:'International Labour Organization (ILO)',kind:'国际劳工标准',for:'想了解国际层面的基本劳动权利、结社、强迫劳动、童工、歧视与安全健康原则',description:'联合国专门机构。其国际劳工标准解释了工作中的基本权利，也提供申诉与救济机制相关主题资料。',url:'https://www.ilo.org/topics-and-sectors/fundamental-principles-and-rights-work',tags:['union','safety','discrimination','contract']},
      {name:'ILO · Grievance handling and access to remedy',kind:'申诉与救济',for:'想先理解“申诉、救济、补救”分别是什么',description:'解释公司或行业层面的 grievance mechanism、争议预防和 remedy 的基本概念。',url:'https://www.ilo.org/topics-and-sectors/labour-dispute-prevention-and-resolution/grievance-handling-and-access-remedy',tags:['contract','retaliation','discrimination']},
      {name:'Worker Rights Consortium (WRC)',kind:'供应链劳工权利调查',for:'服装、制造业供应链中的工人权利与工厂调查',description:'独立、以工人为中心的劳工权利监察组织，公开发布工厂调查、补救进展与相关报告。',url:'https://www.workersrights.org/',tags:['union','pay','safety','discrimination']},
      {name:'International Trade Union Confederation (ITUC)',kind:'国际工会联合组织',for:'了解不同国家的工会权利与年度全球趋势',description:'发布 Global Rights Index 等全球工人权利资料，用于观察结社、集体谈判、暴力与公民自由等趋势。',url:'https://www.ituc-csi.org/global-rights-index',tags:['union','retaliation']}
    ]
  },
  {
    id:'us',
    label:'美国',
    items:[
      {name:'U.S. Department of Labor · Wage and Hour Division',kind:'工资 / 加班 / FMLA 等',for:'工资、最低工资、加班、部分请假与相关报复问题',description:'WHD 说明很多调查由保密投诉启动，并提供正式投诉与咨询入口。',url:'https://www.dol.gov/agencies/whd/contact/complaints',tags:['pay','hours','retaliation']},
      {name:'OSHA · File a Complaint',kind:'工作安全 / 举报保护',for:'危险工作环境、安全健康问题或因安全发声遭报复',description:'OSHA 提供安全健康投诉与 whistleblower complaint 路径；部分时限较短，紧急风险应优先直接联系正式机构。',url:'https://www.osha.gov/workers/file-complaint',tags:['safety','retaliation']},
      {name:'National Labor Relations Board (NLRB)',kind:'集体行动 / 工会 / 不公平劳动行为',for:'认为 NLRA 下的组织、集体行动或工会权利受侵犯',description:'可向 NLRB 提交对雇主或劳工组织的不公平劳动行为指控，并由区域机构调查。',url:'https://www.nlrb.gov/about-nlrb/what-we-do/investigate-charges',tags:['union','retaliation']},
      {name:'Workers United',kind:'工会 / 组织支持',for:'美国和加拿大部分行业的组织、工会与成员支持',description:'Workers United 是 SEIU affiliate，面向其覆盖行业提供组织与成员支持。是否适合你取决于地区和行业。',url:'https://workersunited.org/',tags:['union','pay','safety']}
    ]
  },
  {
    id:'uk',
    label:'英国',
    items:[
      {name:'Acas',kind:'劳动关系 / 就业权利指导',for:'工资、假期、雇佣身份、争议处理与工作关系问题',description:'Acas 提供就业权利与工作关系指导，并说明 worker / employee 等不同身份可能对应的权利差异。',url:'https://www.acas.org.uk/',tags:['pay','hours','contract','discrimination']}
    ]
  },
  {
    id:'au',
    label:'澳大利亚',
    items:[
      {name:'Fair Work Ombudsman',kind:'工作场所权利',for:'工资、工作条件、一般保护、歧视与工业活动相关问题',description:'Fair Work Ombudsman 提供澳大利亚工作场所权利、工资和保护相关指导。',url:'https://www.fairwork.gov.au/employment-conditions/protections-at-work',tags:['pay','hours','contract','discrimination','union']}
    ]
  },
  {
    id:'eu',
    label:'欧盟机构',
    items:[
      {name:'European Ombudsman',kind:'欧盟机构行政申诉',for:'针对 EU institutions / bodies / agencies 的 maladministration，而不是私人雇主的一般劳动纠纷',description:'European Ombudsman 可以调查欧盟机构行政管理不当；它不能处理对私人企业或成员国地方/国家行政机关的一般投诉。',url:'https://www.ombudsman.europa.eu/make-a-complaint',tags:['other']}
    ]
  }
];

export const RESOURCE_DISCLAIMER = '这些链接是公开资源导航，不代表劳动透明计划与相关机构存在合作、隶属、授权或转介关系。每个机构的权限、地区、时限与受理条件不同，请以其官方说明为准。';

export const SOURCE_NOTE = '案例与新闻仅用于帮助理解常见问题和“下一步该记录什么”。本站不会因为一篇报道或外部调查就自动给某家公司下结论；具体事实仍要回到原始来源、适用范围和证据等级。';
