import { createClient } from '@supabase/supabase-js';
import { pipelineConfig } from './lib/pipeline-env.mjs';

const client = createClient(
  pipelineConfig.supabaseUrl,
  pipelineConfig.supabaseServiceRoleKey || pipelineConfig.supabaseAnonKey
);

async function applyAuditCleanup() {
  console.log('1. Unpublishing non-Vizag, remote-only, dead-domain, or duplicate companies...');
  const unpublishList = [
    'BairesDev',
    'Turing',
    'Google',
    'Uber',
    'Armani Exchange',
    'Escape Academy',
    'With Ease Education India',
    'Tablets India',
    'Fresenius Medical Care',
    'PlanetSpark',
    'Patra Corporation',
  ];

  for (const name of unpublishList) {
    const { error } = await client
      .from('companies')
      .update({ is_directory_approved: false, updated_at: new Date().toISOString() })
      .eq('name', name);
    if (error) {
      console.warn(`Warning unpublishing ${name}:`, error.message);
    } else {
      console.log(`Unpublished: ${name}`);
    }
  }

  console.log('\n2. Updating verified URLs for published Vizag companies...');
  const updates = [
    {
      name: 'PBL Transport Corporation',
      website: 'https://www.pbltransport.co.in/',
      careers_url: 'https://www.pbltransport.co.in/',
    },
    {
      name: 'Karur Vysya Bank',
      website: 'https://www.kvb.co.in',
      careers_url: 'https://careers.karurvysya.bank.in',
    },
    {
      name: 'Hetero',
      website: 'https://www.hetero.com',
      careers_url: 'https://www.heterohealthcare.com/careers',
    },
    {
      name: 'Foxconn',
      website: 'https://www.foxconn.com',
      careers_url: 'https://recruit.foxconn.com',
    },
    {
      name: 'JLL',
      website: 'https://www.jll.co.in',
      careers_url: 'https://www.jll.co.in/en/careers',
    },
    {
      name: 'JSE Engineering',
      website: 'https://www.jseengineering.com',
      careers_url: 'https://jseacademy.com/contact-us/',
    },
    {
      name: 'Transasia Bio-Medicals Ltd.',
      website: 'https://transasia.co.in',
      careers_url: 'https://erbamannheim.com/careers',
    },
    {
      name: 'Decorpot',
      website: 'https://www.decorpot.com',
      careers_url: 'https://www.decorpot.com/contact-us',
    },
    {
      name: 'Benovymed Healthcare',
      website: 'https://benovymed.com',
      careers_url: 'https://benovymed.com/contact-us',
    },
    {
      name: 'Teks Academy',
      website: 'https://teksacademy.com',
      careers_url: 'https://teksacademy.com/contact-us/',
    },
    {
      name: 'Kiya World School',
      website: 'https://kiyaworldschool.com',
      careers_url: 'https://kiyaworldschool.com',
    },
    {
      name: 'Eisai Pharmaceuticals India',
      website: 'https://www.eisai.co.in',
      careers_url: 'https://www.eisai.co.in/contactus.html',
    },
    {
      oldName: 'Mdn Edify Education',
      name: 'Edify Education',
      website: 'https://edifyschools.com',
      careers_url: 'https://edifyschools.com/careers/',
    },
    {
      name: 'Patra India',
      website: 'https://patracorp.com',
      careers_url: 'https://patracorp.com/careers/',
      is_directory_approved: true,
    },
    {
      name: 'Pema Wellness Retreat',
      website: 'https://www.pemawellness.com',
      careers_url: 'https://www.pemawellness.com',
      is_directory_approved: true,
    },
    {
      name: 'SITARAM MOTORS',
      website: 'https://sitarammotors.royalenfield.com',
      careers_url: 'https://sitarammotors.royalenfield.com',
      is_directory_approved: true,
    },
    {
      name: 'GITAM Deemed University',
      website: 'https://www.gitam.edu',
      careers_url: 'https://careers.gitam.edu',
      is_directory_approved: true,
    },
    {
      name: 'SIMS College',
      website: 'http://www.simsvizag.com',
      careers_url: 'http://www.simsvizag.com/contact-us.html',
      is_directory_approved: true,
    },
    {
      name: 'MGM Healthcare',
      website: 'https://mgmsevenhills.in',
      careers_url: 'https://mgmhealthcare.in/careers/',
      is_directory_approved: true,
    },
    {
      name: 'DA VINCI INTERNATIONAL SCHOOL',
      website: 'https://davincischool.in',
      careers_url: 'https://davincischool.in/contact.html',
      is_directory_approved: true,
    },
  ];

  for (const item of updates) {
    const targetName = item.oldName || item.name;
    const updatePayload = {
      name: item.name,
      website: item.website,
      careers_url: item.careers_url,
      updated_at: new Date().toISOString(),
    };
    if (item.is_directory_approved !== undefined) {
      updatePayload.is_directory_approved = item.is_directory_approved;
    }

    const { error } = await client
      .from('companies')
      .update(updatePayload)
      .eq('name', targetName);
    if (error) {
      console.warn(`Warning updating ${targetName}:`, error.message);
    } else {
      console.log(`Updated: ${item.name} (${item.website})`);
    }
  }

  console.log('\nAudit updates applied successfully!');
}

applyAuditCleanup();
