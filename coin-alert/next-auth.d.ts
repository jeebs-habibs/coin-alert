import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      name?: string | null;
      email?: string | null;
      image?: string | null;
      id?: string | null; // Added `id`
    };
    accessToken?: string; // Added `accessToken`
  }

  interface JWT {
    id?: string;
    accessToken?: string;
  }
}
