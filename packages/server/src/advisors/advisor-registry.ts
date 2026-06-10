export const advisorRegistry = [
  {
    id: 'data-dashboard',
    name: 'Data Dashboard Advisor',
    description: 'Looker Studio and decision-ready dashboard mentoring',
    promptDocId: '1mZX8QwMhHDYG_jjH2CMCCr5oqChjrlJo1muVdmhxki0'
  },
  {
    id: 'ssot-memo',
    name: 'SSOT Memo Advisor',
    description: 'Single source of truth memo and interview-guide mentoring',
    promptDocId: '1FX1A1399qjTNLT397HVqSpFHvBVpnKFSpJClTrap2JA'
  },
  {
    id: 'data-modeling',
    name: 'Data Modeling Advisor',
    description:
      'Data modeling, schema design, and analytics architecture mentoring',
    promptDocId: '1JjqZoSoX1PuFFFzpDLB7A7YE2k8--0UzmMTO2bGggJw'
  }
] as const;

export const sharedDnaDocId = '1jQCF3lhyjAKbyEnK1fwDIalW05l8W5TJTZnaKZ9Tktw';

export type RegisteredAdvisorId = (typeof advisorRegistry)[number]['id'];
