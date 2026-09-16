import unittest
from unittest import mock

from scripts.community_agent import nmpa_udi_daily as agent_http


class AgentControlFallbackTests(unittest.TestCase):
    def test_canonical_api_uses_bounded_d1_fallback_when_command_line_network_fails(self):
        expected = {"items": [{"id": "co_x", "name": "示例公司"}]}
        with mock.patch.object(agent_http, "_curl_request", side_effect=RuntimeError("network unavailable")) as curl_call, \
             mock.patch.object(agent_http, "_d1_control_fallback", return_value=expected) as d1_call:
            result = agent_http.http_json(f"{agent_http.DEFAULT_ORIGIN}/api/companies")
        self.assertEqual(result, expected)
        curl_call.assert_called_once()
        d1_call.assert_called_once_with(
            f"{agent_http.DEFAULT_ORIGIN}/api/companies", method="GET", payload=None, token=""
        )

    def test_d1_fallback_refuses_trusted_mutation_without_agent_credential(self):
        with self.assertRaisesRegex(RuntimeError, "refuses trusted mutations"):
            agent_http._d1_control_fallback(
                f"{agent_http.DEFAULT_ORIGIN}/api/community-agent/announcements",
                method="POST", payload={"day": "2026-09-16"}, token="",
            )

    def test_d1_fallback_refuses_noncanonical_hosts_and_query_strings(self):
        with self.assertRaisesRegex(RuntimeError, "canonical production API"):
            agent_http._d1_control_fallback("https://example.org/api/companies")
        with self.assertRaisesRegex(RuntimeError, "canonical production API"):
            agent_http._d1_control_fallback(f"{agent_http.DEFAULT_ORIGIN}/api/companies?x=1")


if __name__ == "__main__":
    unittest.main()
