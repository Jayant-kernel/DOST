import {notFound} from 'next/navigation';
import {VoicePreview} from '@/components/VoicePreview';
import {VoiceListeningStudy} from '@/components/VoiceListeningStudy';
export default async function VoicePreviewPage({searchParams}:{searchParams:Promise<{study?:string}>}){if(process.env.NODE_ENV==='production')notFound();return (await searchParams).study==='1'?<VoiceListeningStudy />:<VoicePreview />;}
