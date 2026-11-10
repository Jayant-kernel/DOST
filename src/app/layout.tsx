import type {Metadata} from 'next';
export const metadata:Metadata={title:'Dost core',description:'Development conversation backend'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>;}
