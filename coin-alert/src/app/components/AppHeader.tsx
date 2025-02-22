// 'use client'

// import Link from "next/link";
// import { useRouter } from "next/navigation";
// import { signOut } from "../lib/firebase/auth";
// import { useAuth } from "../providers/auth-provider";
// import { Button } from "./Button";

// export const AppHeader = () => {
//     const router = useRouter();
//     const { user,loading } = useAuth();
  
//     // Render the signed in experience.
//     let authContent = null;
//     if (user != null) {
//       authContent = (
//         <div style={{marginLeft: "auto"}}>
//           <Button 
//             onClick={() => {
//                 signOut()
//                 router.push("/")
//             }}
//             variant="danger"
//           >
//             Sign out
//           </Button>
//         </div>
//       );
//     } else if (loading) {
//       authContent = <div className="spinner-border m-auto" role="status"></div>;
//     } else {
//       authContent = (
//           <Link href="/auth" passHref style={{marginLeft: "auto"}}>
//             <Button
//               variant="primary"
//             >
//              Sign in
//             </Button>
//           </Link>
//       );
//     }
  
//     return (
//       <header>
//         <div style={{display: "flex", justifyContent: "space-between", alignItems: "center"}}>
//           {authContent}
//         </div>
//       </header>
//     );
//   };