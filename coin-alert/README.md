This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

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
- Store user -> tokensOwned mapping in local variable
- Get unique tokens across all users
    - For each token, get price and store in cache. Check cache for metadata, if nothing in cache, metadata from chain and store in cache
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
