"use client";

import { useAuth } from "@/app/providers/auth-provider";
import { useEffect, useState } from "react";
import { getUserData, updateWallets } from "../lib/firestore";

export default function Dashboard() {
  const { user, loading } = useAuth();
  const [wallets, setWallets] = useState<string[]>([]);
  const [newWallet, setNewWallet] = useState<string>("");

  useEffect(() => {
    if (user) {
      // Fetch user data
      getUserData(user.uid).then((data) => {
        if (data?.wallets) {
          setWallets(data.wallets);
        }
      });
    }
  }, [user]);

  const handleAddWallet = async () => {
    if (!newWallet) return;

    const updatedWallets = [...wallets, newWallet];
    setWallets(updatedWallets);
    setNewWallet("");

    if (user) {
      await updateWallets(user.uid, updatedWallets);
    }
  };

  const handleRemoveWallet = async (wallet: string) => {
    const updatedWallets = wallets.filter((w) => w !== wallet);
    setWallets(updatedWallets);

    if (user) {
      await updateWallets(user.uid, updatedWallets);
    }
  };

  if (loading) return <p>Loading...</p>;

  if (!user) {
    return <p>You must be signed in to view this page.</p>;
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <h1 className="text-2xl font-bold mb-4">Dashboard</h1>
      <p className="mb-6">Manage your wallets below:</p>

      <div className="w-full max-w-md">
        <div className="mb-4">
          <input
            type="text"
            value={newWallet}
            onChange={(e) => setNewWallet(e.target.value)}
            placeholder="Enter new wallet address"
            className="w-full px-4 py-2 border rounded-md mb-2"
          />
          <button
            onClick={handleAddWallet}
            className="w-full bg-blue-500 text-white py-2 rounded-md hover:bg-blue-600"
          >
            Add Wallet
          </button>
        </div>

        <ul className="list-disc list-inside">
          {wallets.map((wallet) => (
            <li key={wallet} className="flex justify-between items-center">
              <span>{wallet}</span>
              <button
                onClick={() => handleRemoveWallet(wallet)}
                className="text-red-500 hover:underline"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
