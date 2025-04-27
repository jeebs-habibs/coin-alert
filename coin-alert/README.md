This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## TODO
- For coins still on pump bonding curve, we keep checking both raydium and pump. This is wasting a crazy amount of time.



- Dont notify if it contains word infinity in it
- Add recent notis to dashboard 





## Issues

### Duplicate Notis
- Haven't solved yet, no clue whats going on.

### Dead tokens should result in far less DB writes/reads
- Problem: On each execution, we get all unique tokens from blockchain. If the prices in the db havent changed, we remove that token from the database.
    However, on the next execution, we will have no way of telling whether the coin is dead or not, and will add price back. 
- Solution: Store a collection of dead tokens in the database. Then after we get all unique tokens from blockchain, we can filter out dead tokens.


Current:
- Get all users and their wallets
- Get unique tokens from blockchain
- Get latest price for token
- Store in DB

Then in checkPriceAlerts...
- Loop through each user and get their tokens from blockchain
- Check token price in local variable or db
- If token price changed a lot, send noti

Where T is number of total tokens. T = 5000, D = 4,500 dead and A = 500 active
U = number of users

Total Reads: FirstApi(U) + SecondAPI(U + T + RNS) // should add duplicated blockchain calls as well
Total Writes: FirstApi(T) + SecondAPI(RNS) // should add duplicated blockchain calls as well

With dead token logic
FirstAPI
- Get all users from db and their wallets
- Get all dead tokens from db 
- Get all tokens from blockchain
- Filter to only alive tokens
- Get price for alive tokens and store in db

SecondAPI
- Loop through each user and get their tokens from blockchain
- Get alive tokens
- IF token price changed a lot, sent noti


Total reads: FirstAPI(U + DT) + SecondAPI(AT)
Total writes: FirstAPI(AT) + SecondAPI(RNS)


U = 100
T = 20000
DT = 15000
AT = 5000

Current:
Total Reads: FirstApi(U) + SecondAPI(U + T) = 100 + 100 + 20000  = 20200
Total Writes: FirstApi(T) + SecondAPI(RNS) = 20000

With dead token check:
Total reads: FirstAPI(U + DT) + SecondAPI(u + AT) = 100 + 15000 + 5000 = 20200
Total writes: FirstAPI(AT) + SecondAPI(RNS) = 5000

With 1 API
Total reads: U + T = 100 + 20000 = 20100
Total writes: (AT) + SecondAPI(RNS) = 5000


Future:
Every minute (or 2):
- Get all users from database 
- Get all unique tokens from blockchain
- For each token, get token from db and check if its dead
- If its dead, skip updating the price
- If not dead, update price

Reads: U + T
Writes: AT

Lets try and make 1 API

If persistent server:
- fetch user data from DB and cache it every 10 minutes
- Every minute, update map of user -> (tokensHeld) from chain. From this, get all unique tokens held from all users
- If token is dead, skip getting data for it. 
- If not, get token metadata if not present in map of token -> tokenData , and get price and update map with last hour of prices
- Loop through each user tokens and if a token price change breaches threshold (and no noti cooldown)

Read U from Firestore every 10 minutes 
Calling chain AT times per minute

What does this save?
- Only refreshing user data every 10 minutes rather than every minute. User data we need: wallets, notification settings...anything else?
- No more reading Firestore for token data (save T reads per minute)
- No more writing Firestore for token data (save AT writes per minute)
- No more writing recent notifications to firestore (storing locally)

Open questions:
- If we extend dead check to a couple days, where will we store this price? Will we still need to store token price?
    Maybe only check dead tokens once every few days? Idk
- Do db savings outweight ec2 costs? https://aws.amazon.com/ec2/pricing/on-demand/  seems like 30-60$ a month avg


50$ quicknode a month for live price fetching. $$ a month for databse with current structure vs $$ a month with 1 API vs $$ a month with dedicated server.

looking at 110 a month

if we sell it for .1 SOL a month, would need 10 active users a month to profit


## Server decision
Problem statement: We are hitting daily firestore usage limit when running every 2 minutes for about 4 hours. We need a solution so we can scale more easily.
In updateTokens API we are getting all users from Firestore, getting their tokens from chain and updating firestore with all unique tokens including price and other data
In checkPriceAlerts API, we are getting all users from Firestore and unique tokens owned by each user on chain. we then look at the price data for each token a user owns and send notification if applicable.

Wasted reads/writes:
- Price data writing to DB when only last hour is needed
- Storing recent notis in DB when we only need last one
- Getting all users in both apis and all tokens they own
- Getting 

Proposed state:
1 API:
- Get all users from DB with notifications on
- Get all unique tokens from blockchain for those users.
- Get each token from Db and filter out dead tokens
- Store user -> aliveTokensOwned mapping in local variable
- For each user, check if price of their tokens owned changed. Check cache for recent notis. If none sent, send noti and add to cache 

Maybe a separate API that checks cache and if price data hasnt changed in an hour we call the token dead and add an entry. Then at beginning of above API we remove dead tokens

8000 reads and 4000 writes an hour


## DECISION

Going to stay with firestore. Scaling seems cheap and by removing some old (dead) tokens I think we can save a lot of costs. 


## Issues
- Only ones we cant get price data for: 2zMMhcVQEXDtdE6vsFS7S7D5oUodfJHE8vd1gnBouauv,8hRiwqXceFL12paSiVRYFNh7eS58NpJQYzV9aN1mC7W5,7bMQQSYmrJjgDcqxYEpyMdPVp65k1VKAe5ZhjAWwAT2j
- Pudgy maybe on diff pool? 2025 Raydium CLMM or CPMM, and last one i cant even find

## Latest Metrics
Failed to get price for 22 tokens: 2zMMhcVQEXDtdE6vsFS7S7D5oUodfJHE8vd1gnBouauv,36mE6cvruVKF4tsnTf4BRAS32ErVR5cm3dVvjGdHpump,HsRR67PuNMernSZPMjLxZ6DWdJKMFK1qAB2NvucQ8ZXH,956ou1nJek6dCSQo4hN6pUkgw2oL2zHcfLcfnYNxpump,E3P5w17LjgLchvRC7gsAnmG84yVQLccC8K4re6xSpump,3Cnf7LVqTbLGYuGFwy2ua6nR5vn2PEbEzgfwsYUspump,9DHe3pycTuymFk4H4bbPoAJ4hQrr2kaLDF6J6aAKpump,8hRiwqXceFL12paSiVRYFNh7eS58NpJQYzV9aN1mC7W5,d5t1qzobqenc5r3ownXKefeRysL1qFBLAv4cU1Apump,AuVGPGcofcPTiH7ne6e3VvRgBYFDFFHVQWM1HfLGrwrj,J99YdKkGKY2yZJY6mEdQG19ac2Fa4U9YGodcDtATpump,B6U9KKAttXcc6HDKZviA9o9BUDXSqVus82gCAe3Apump,Umur6zd51qnixSBk7XfEvVLHXdoZjTiBysam64PDf83,q45iT3JuSDgrPhjcfUBToSAo58r9mEYPSQgWTW2CqeY,7bMQQSYmrJjgDcqxYEpyMdPVp65k1VKAe5ZhjAWwAT2j,GS3ZRVhQS5EqwHkzUenBcEEQAYH3C9Fs2PmEFN37p4pw,2hSf1yGRhJsmN8dFrRaeFr3LbDnVCWCPgrsMQGHcpump,8dHWG9GZ1HqYqFpB6GXLdtopwFKxbMibLom2FaMqpump,3Z5kGSYy634tuCbN2GQzu2fecEysyEnWMbfYboimpump,FCHyom1R7aNEEkT67hM1CVkLba4whvAkWY9Lzjk7pump,APABrboSovPNHHPEJMDGM8c1eA1EfjYZSvBSgDAQpump,27VSrng15AzufqA4SaB2aHRVjmBDT6XxE9PZHC9cpump
=====API METRICS=====
Update firestore: 85.89156626506023 ms (avg) 175 ms (max)
Delete firestore: 72.3012048192771 ms (avg) 120 ms (max)
Get token price: 923.6666666666666 ms (avg) 3459 ms (max)
✅ Unique tokens updated in Firestore.
 GET /api/updateTokens 200 in 97579ms

## Backoff vs Pace control
- Backoff finished in 27-ish seconds but with some errors that we were calling too much
- Pace control took 171 seconds with no errors. 

6 calls max per coin
105 coins * 6 calls = 630 total calls
should take 42 seconds max.


## Reasons we cant get price
- There are multiple pools for the token (PENGU)

tokens to investigate:
- AuVGPGcofcPTiH7ne6e3VvRgBYFDFFHVQWM1HfLGrwrj
- Sig: 2SepAG32mecn8sEGjHNHT5RQYscSxZzjTQdsdp5ruRvaTtnpfZExodQsYnYyNJyhZiVgeUG8SZ86fW3xUdWQcoPK
- 27VSrng15AzufqA4SaB2aHRVjmBDT6XxE9PZHC9cpump: Most recent transaction was a failed one, will need logic to retry here.


## TODO
- Eventually add code to remove 'dead coins'. These are coins that haven't had activty for > 30 days?

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
