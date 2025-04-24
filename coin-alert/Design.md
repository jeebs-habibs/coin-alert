## Overview
We currently are running minutely vercel server functions to get prices and send notifications. Some drawbacks:
- For just 3 users, we cannot get all price data that quickly and job times out after 60 seconds
- Even if we used another service, we probably should fetch data a bit quicker
As of now our biggest bottleneck is quicknode 15 requests per second. For 50$ a month we could do 50/second but unclear if this is quick enough.

What we need to answer: How long are we currently taking? How can we speed it up for testing with andrew?

Lets solve testing, then solve scale problem after we have proven the idea.