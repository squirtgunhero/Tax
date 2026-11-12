import type {ReactNode} from "react";
export const metadata={title:"Public Ledger",description:"Understand public spending and the decisions behind it."};
export default function Layout({children}:{children:ReactNode}){return <html lang="en"><body style={{margin:0,fontFamily:"system-ui, sans-serif",background:"#f8f8f5",color:"#161b18"}}>{children}</body></html>}
