import { auth } from '@/app/lib/firebase/firebaseAdmin';
import { getAllUsers, getUser, updateUser } from '@/app/lib/firebase/userUtils';
import { NextRequest, NextResponse } from 'next/server';
import { ReferralCode } from '../../../../../shared/types/user';

export async function POST(request: NextRequest) {
  try {
    const { referralCode, uid, wallet } = await request.json();

    if (!referralCode || !uid || !wallet) {
      return NextResponse.json({ error: 'referralCode, uid, and wallet are required' }, { status: 400 });
    }

    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const idToken = authHeader.split('Bearer ')[1];
    let decodedToken;
    try {
      decodedToken = await auth.verifyIdToken(idToken);
      if (decodedToken.uid !== uid) {
        return NextResponse.json({ error: 'Token UID does not match provided UID' }, { status: 403 });
      }
    } catch (error) {
      console.error('❌ Invalid token:', error);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await getUser(uid);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (user.referralCode) {
      return NextResponse.json({ error: 'Referral code already exists for this user' }, { status: 400 });
    }

    const existingUsers = await findUsersByReferralCode(referralCode);
    if (existingUsers.length > 0) {
      return NextResponse.json({ error: 'Referral code already in use' }, { status: 409 });
    }

    const referralCodeData: ReferralCode = {
      referralCode: referralCode.toLowerCase(),
      wallet,
      timestampCreatedMs: Date.now(),
      uses: []
    };

    user.referralCode = referralCodeData;
    await updateUser(uid, user);

    return NextResponse.json({ success: true, referralCode: referralCodeData }, { status: 200 });
  } catch (error) {
    console.error('❌ Error in createReferralCode:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

async function findUsersByReferralCode(code: string) {
  // Replace this with actual DB query logic for checking uniqueness
  const allUsers = await getAllUsers();
  return allUsers.filter((user) => user?.referralCode?.referralCode === code.toLowerCase());
} 
