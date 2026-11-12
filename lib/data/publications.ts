import { cached, DataError, request } from './http';
import { metadata } from './model';
export async function getPublications() {
 return cached('nj-publications',900000,async()=>{
  const url='https://www.nj.gov/treasury/omb/';
  const html=await request(url,{},true) as string;
  const links=[...html.matchAll(/href\s*=\s*["']([^"']+\.pdf)["']/gi)].map(m=>new URL(m[1],url));
  const documents=[...new Map(links.filter(u=>u.hostname==='www.nj.gov' && u.pathname.startsWith('/treasury/omb/publications/')).map(u=>[u.href,{url:u.href,title:decodeURIComponent(u.pathname.split('/').pop()!).replace(/\.pdf$/i,'').replace(/[-_]/g,' '),collection:decodeURIComponent(u.pathname.split('/').slice(-2,-1)[0]),kind:/\/\d+approp\//.test(u.pathname)?'appropriation':/\/\d+fr\//.test(u.pathname)?'financial-report':'budget-document'}])).values()];
  if(!documents.length) throw new DataError('SCHEMA_CHANGED','OMB publication links were not found.');
  return {status:'live',documents,source:metadata('NJ Treasury · Office of Management and Budget',url,'publication-index','As linked by OMB'),disclaimer:'Official publication links discovered from OMB. Document contents and fiscal amounts are not extracted or verified. Budget recommendations and appropriations are not actual expenditures. Publication filenames are not evidence of enactment.'};
 });
}
