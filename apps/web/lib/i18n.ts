export function getCorrespondentByBeat(article: { district?: string | null; category?: string | null; title?: string | null }): string {
  const dist = (article.district || '').toLowerCase().trim();
  const cat = (article.category || '').toLowerCase().trim();
  const title = (article.title || '').toLowerCase();

  // Chenab Valley
  if (['doda', 'kishtwar', 'ramban'].includes(dist) || title.includes('chenab') || title.includes('doda') || title.includes('kishtwar') || title.includes('ramban') || title.includes('bhaderwah') || title.includes('marwah') || title.includes('warwan')) {
    return 'Tariq Ahmad Mir';
  }
  // Pir Panjal
  if (['rajouri', 'poonch'].includes(dist) || title.includes('poonch') || title.includes('rajouri') || title.includes('pir panjal') || title.includes('chakan da bagh') || title.includes('surankote') || title.includes('mandi-lorha')) {
    return 'Showkat Ahmad Mir';
  }
  // Ladakh
  if (['leh', 'kargil'].includes(dist) || title.includes('ladakh') || title.includes('leh') || title.includes('kargil') || title.includes('zojila') || title.includes('drass')) {
    return 'Stanzin Dorje';
  }
  // Jammu Plains / Economy
  if (['jammu', 'samba', 'kathua', 'udhampur', 'reasi'].includes(dist) || cat.includes('economy') || cat.includes('business') || cat.includes('agriculture') || title.includes('jammu') || title.includes('samba') || title.includes('kathua') || title.includes('r.s. pura') || title.includes('mandi')) {
    return 'Pooja Jamwal';
  }
  // Culture & Heritage
  if (cat.includes('culture') || cat.includes('heritage') || title.includes('saffron') || title.includes('craft') || title.includes('heritage') || title.includes('shawl')) {
    return 'Prof. Ramesh Koul';
  }
  // National & Science
  if (cat.includes('national') || cat.includes('science') || cat.includes('health') || cat.includes('space') || cat.includes('international') || title.includes('supreme court') || title.includes('isro') || title.includes('rbi') || title.includes('un ')) {
    return 'Dr. Sunita Pandita';
  }
  // Kashmir Valley default
  return 'Dr. Tariq Ahmad Lone';
}

export function applyTranslations<
  T extends {
    article_translations?: { language_code: string; title: string; excerpt?: string | null }[];
    title: string;
    excerpt?: string | null;
    author_display_name?: string | null;
    district?: string | null;
    category?: string | null;
  }
>(articles: T[], _lang?: string): T[] {
  return articles.map((article) => {
    let author = article.author_display_name?.trim();
    if (!author || author === 'Hafeez Zargar' || author === 'Hafiz Zargar' || author === 'KJCPL Team' || author === 'Team' || author.startsWith('KJIN') || author.includes('Bureau')) {
      author = getCorrespondentByBeat(article);
    } else if (author.includes('KJIN')) {
      author = author.replace(/\bKJIN\b/g, 'KJCPL');
    } else if (author.startsWith('KCPJLN')) {
      author = author.replace(/\bKCPJLN\b/g, 'KJCPL');
    }

    return {
      ...article,
      author_display_name: author,
    };
  });
}
