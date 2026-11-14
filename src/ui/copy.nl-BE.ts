export const copy = {
  appName: 'Ochtendroutine',
  session: {
    childDone: 'Klaar! Nu mag je spelen',
    playtimeLabel: 'speeltijd',
    warning10: 'Nog 10 minuten',
    warning5: 'Nog 5 minuten',
    departure: 'Jas aan, we vertrekken!',
  },
  kids: {
    countdown: (minutes: number) => `nog ${minutes} min`,
    companions: {
      egel: 'egel',
      muis: 'muis',
      vos: 'vos',
      konijn: 'konijn',
      uil: 'uil',
      schildpad: 'schildpad',
    },
  },
  calendar: {
    noSchool: 'Geen school',
  },
  parent: {
    departed: 'We zijn vertrokken',
  },
  backup: {
    create: 'Backup maken',
    restore: 'Backup terugzetten',
  },
} as const
