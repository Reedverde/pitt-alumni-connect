/** Nickname equivalence for given names, applied at match time only.
 *  No stored name is ever rewritten. Groups are treated as an undirected
 *  graph, so shared names (jack, hal, jerry, chris) join their sets. */

const GROUPS: string[][] = [
  ["robert", "rob", "bob", "bobby"],
  ["william", "will", "bill", "billy", "liam", "willie"],
  ["richard", "rich", "rick", "dick"],
  ["michael", "mike", "mick", "mickey"],
  ["james", "jim", "jimmy", "jamie"],
  ["john", "jon", "johnny", "jack"],
  ["joseph", "joe", "joey"],
  ["charles", "charlie", "chuck", "chas"],
  ["thomas", "tom", "tommy"],
  ["christopher", "chris", "topher"],
  ["daniel", "dan", "danny"],
  ["matthew", "matt", "matty"],
  ["anthony", "tony", "ant"],
  ["donald", "don", "donnie"],
  ["mark", "marc", "marcus"],
  ["paul"],
  ["steven", "stephen", "steve", "stevie"],
  ["andrew", "andy", "drew"],
  ["kenneth", "ken", "kenny"],
  ["joshua", "josh"],
  ["kevin", "kev"],
  ["brian", "bryan"],
  ["george", "geo"],
  ["edward", "ed", "eddie", "ted", "teddy"],
  ["ronald", "ron", "ronnie"],
  ["timothy", "tim", "timmy"],
  ["jason", "jay"],
  ["jeffrey", "jeff", "geoff", "geoffrey"],
  ["ryan"],
  ["jacob", "jake"],
  ["gary"],
  ["nicholas", "nick", "nicky"],
  ["eric", "erik"],
  ["jonathan", "jon", "jonny"],
  ["larry", "lawrence"],
  ["justin"],
  ["scott"],
  ["brandon"],
  ["benjamin", "ben", "benji", "benny"],
  ["samuel", "sam", "sammy"],
  ["gregory", "greg"],
  ["alexander", "alex", "xander", "sasha"],
  ["patrick", "pat", "paddy", "rick"],
  ["frank", "francis", "frankie"],
  ["raymond", "ray"],
  ["dennis", "denny"],
  ["jerry", "jerome", "gerald", "gerry"],
  ["tyler", "ty"],
  ["aaron", "erin"],
  ["jose"],
  ["adam"],
  ["nathan", "nate", "nathaniel"],
  ["henry", "hank", "hal"],
  ["zachary", "zach", "zack"],
  ["douglas", "doug"],
  ["peter", "pete"],
  ["kyle"],
  ["walter", "walt"],
  ["ethan"],
  ["jeremy", "jerry"],
  ["harold", "harry", "hal"],
  ["keith"],
  ["christian", "chris"],
  ["roger", "rodge"],
  ["noah"],
  ["carl", "karl"],
  ["terry", "terrance", "terence"],
  ["sean", "shaun", "shawn", "john"],
  ["austin"],
  ["arthur", "art", "artie"],
  ["jesse", "jess"],
  ["dylan", "dyl"],
  ["jordan", "jordy"],
  ["bruce"],
  ["albert", "al", "bert"],
  ["gabriel", "gabe"],
  ["logan"],
  ["alan", "allen", "al"],
  ["juan"],
  ["wayne"],
  ["roy"],
  ["ralph"],
  ["randy", "randall", "randolph"],
  ["eugene", "gene"],
  ["vincent", "vince", "vinny"],
  ["russell", "russ"],
  ["elijah", "eli"],
  ["louis", "lou", "louie"],
  ["philip", "phillip", "phil"],
  ["mason"],
  ["micah"],
  ["isaac", "ike"],
  ["hafeez"],
];

/** name -> full connected set (union-find over the groups). */
const SETS = new Map<string, Set<string>>();

(() => {
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    const p = parent.get(x);
    if (p === undefined || p === x) {
      parent.set(x, x);
      return x;
    }
    const root = find(p);
    parent.set(x, root);
    return root;
  };
  const union = (a: string, b: string) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };
  for (const group of GROUPS) {
    for (const name of group) find(name);
    for (let i = 1; i < group.length; i++) union(group[0], group[i]);
  }
  for (const name of parent.keys()) {
    const root = find(name);
    let set = SETS.get(root);
    if (!set) {
      set = new Set<string>();
      SETS.set(root, set);
    }
    set.add(name);
  }
  // Re-key by every member so lookup is direct.
  const byMember = new Map<string, Set<string>>();
  for (const set of SETS.values()) for (const name of set) byMember.set(name, set);
  SETS.clear();
  for (const [name, set] of byMember) SETS.set(name, set);
})();

/** Every interchangeable form of a given name, including the name itself.
 *  Returns just the input when it is not a known given name. */
export function equivalentNames(token: string): string[] {
  const key = token.toLowerCase();
  const set = SETS.get(key);
  if (!set) return [key];
  return Array.from(set);
}

/** True when the token has at least one nickname equivalent. */
export function hasEquivalents(token: string) {
  return SETS.has(token.toLowerCase());
}
