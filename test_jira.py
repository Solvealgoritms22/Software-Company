import asyncio
import httpx
import json

async def test_jira():
    url = "https://darlingf1998.atlassian.net/rest/api/3/issue"
    auth = ("darlingf1998@gmail.com", "ATATT3xFfGF0wg5X0H0Fk2ajs-9NGekP4BE28GTvoPmmyHanukciiMMvrmAxla6aTHY_VxKMtXYerZgRxxdi9wcZvDcThKRntrRkh04oSBPXi0v7UOMPi5SkjLqg3kVYWVAdQ-WPDvJk2I5a-3sx-y_VEuMnZLQga2VDt24WBKFR4pvrm5YhHnY=B504CC59")
    
    payload = {
        "fields": {
            "project": {"key": "SCRUM"},
            "summary": "Test Issue from Agent",
            "description": {
                "type": "doc",
                "version": 1,
                "content": [
                    {
                        "type": "paragraph",
                        "content": [{"type": "text", "text": "This is a test issue."}]
                    }
                ]
            },
            "issuetype": {"name": "Epic"}
        }
    }
    
    async with httpx.AsyncClient() as client:
        response = await client.post(url, json=payload, auth=auth)
        print(response.status_code)
        print(response.text)

asyncio.run(test_jira())
