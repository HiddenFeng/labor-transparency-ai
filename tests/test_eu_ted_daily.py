import datetime as dt
import unittest
from scripts.community_agent import eu_ted_daily as ted

class EuTedDailyTests(unittest.TestCase):
    def test_exact_winner_only_becomes_relation(self):
        company={'id':'co_airbus','name':'Airbus Defence and Space GmbH','region':'Germany','synthetic':False}
        notice={'publication-number':'746266-2023','publication-date':'2023-12-08Z','winner-name':{'deu':['Airbus Defence and Space GmbH']},'buyer-name':{'deu':['Bundesamt für Ausrüstung, Informationstechnik und Nutzung der Bundeswehr']},'notice-title':{'eng':'Germany – Satellite services – Example award'},'links':{'html':{'ENG':'https://ted.europa.eu/en/notice/-/detail/746266-2023'}}}
        rel=ted.relation_from_notice(company,notice,'WINNER')
        self.assertIsNotNone(rel);self.assertEqual(rel['provider'],'EU_TED');self.assertEqual(rel['relationType'],'PUBLIC_PROCUREMENT_RELATION');self.assertEqual(rel['objectExternalId'],'746266-2023');self.assertEqual(rel['attributes']['participantRole'],'WINNER');self.assertIn('specific published procurement event',rel['caveat'])
        fuzzy={**notice,'winner-name':{'deu':['Airbus Defence and Space GmbH - Division X']}}
        self.assertIsNone(ted.relation_from_notice(company,fuzzy,'WINNER'))

    def test_collect_filters_ineligible_and_requires_exact_post_filter(self):
        companies=[{'id':'co_airbus','name':'Airbus Defence and Space GmbH','region':'Germany','synthetic':False},{'id':'co_cn','name':'示例公司','region':'中国','synthetic':False}]
        exact={'publication-number':'1-2026','publication-date':'2026-09-15Z','winner-name':{'eng':['Airbus Defence and Space GmbH']},'buyer-name':{'eng':['Buyer A']},'notice-title':{'eng':'Award A'},'links':{}}
        fuzzy={'publication-number':'2-2026','publication-date':'2026-09-15Z','winner-name':{'eng':['Airbus Defence and Space GmbH Unit']},'buyer-name':{'eng':['Buyer B']},'notice-title':{'eng':'Award B'},'links':{}}
        calls=[]
        def fetch(url,method='GET',payload=None,**kwargs):
            calls.append(payload['query']);
            return {'notices':[exact,fuzzy]} if payload['query'].startswith('winner-name') else {'notices':[]}
        rows,metrics=ted.collect(companies,dt.date(2026,9,9),dt.date(2026,9,16),fetch=fetch)
        self.assertEqual(metrics['eligibleCompanies'],1);self.assertEqual(metrics['requests'],2);self.assertEqual(len(rows),1);self.assertEqual(rows[0]['sourceRecordId'],'1-2026');self.assertEqual(len(calls),2)

    def test_region_gate_and_query_window(self):
        self.assertEqual(ted.region_code('Germany'),'DE');self.assertEqual(ted.region_code('DE'),'DE');self.assertEqual(ted.region_code('中国'),'')
        q=ted.query_body('Robert Bosch GmbH','WINNER',dt.date(2024,1,1),dt.date(2024,12,31))['query']
        self.assertIn('winner-name ~ "Robert Bosch GmbH"',q);self.assertIn('PD = (20240101 <> 20241231)',q)

if __name__=='__main__': unittest.main()
