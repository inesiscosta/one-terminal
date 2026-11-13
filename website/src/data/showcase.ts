/**
 * Sites that use One Terminal. Only list sites that publicly use the package, describe them
 * factually, and don't use their logos or screenshots without asking.
 */
export type ShowcaseSite = {
  name: string;
  description: string;
  url: string;
};

export const showcase: ShowcaseSite[] = [
  {
    name: 'NEIIST',
    description:
      'The student association for informatics at Instituto Superior Técnico, with a terminal in its homepage hero.',
    url: 'https://neiist.tecnico.ulisboa.pt',
  },
  {
    name: 'Guilherme Marques',
    description: 'A computer science student’s portfolio with a terminal you can explore.',
    url: 'https://marques.at.eu.org',
  },
];
