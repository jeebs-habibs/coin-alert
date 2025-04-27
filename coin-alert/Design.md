## Overview
We currently are running minutely vercel server functions to get prices and send notifications. Some drawbacks:
- For just 3 users, we cannot get all price data that quickly and job times out after 60 seconds
- Even if we used another service, we probably should fetch data a bit quicker
As of now our biggest bottleneck is quicknode 15 requests per second. For 50$ a month we could do 50/second but unclear if this is quick enough.

What we need to answer: How long are we currently taking? How can we speed it up for testing with andrew?

Lets solve testing, then solve scale problem after we have proven the idea.

Conclusion
- Still when i run it locally it takes forever. NEED BALLPARK FOR HOW LONG IT TAKES NOW.
- Quicknode is rate limiting a bunch of shit, and i wont be able to get it on minutely cadence as of now
- Can maybe create a lambda and update coin prices every 15 minutes or so while using redis.
- Maybe a separate hourly job that just sets pool data, another one that fetches prices from pool, and another to send notifications.



Let's discuss ways to optimize:

- Filter out coins with less than 50 held. 
- Maybe a different workflow runs minutely. Reads all tokens from db where pool is undefined, and sets the pool data. Over time this should be very minimal operation.
- Then separate job gets non-dead token prices (sets in Redis preferrably)
- Then last job sends notifications.

Creating seperate jobs allows each to not be blocked by each other, but will increase db reads/writes. we should use redis for price data with TTL of 1 hour.