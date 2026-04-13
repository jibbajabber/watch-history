export type ChannelBrand = {
  key: string;
  label: string;
  logoPath: string;
  aliases: string[];
};

const channelBrands: ChannelBrand[] = [
  {
    key: "bbc-one",
    label: "BBC One",
    logoPath: "/channel-logos/bbc-one.svg",
    aliases: ["bbc one", "bbc one hd", "bbc one lon", "bbc one lon hd", "bbc one london"]
  },
  {
    key: "bbc-two",
    label: "BBC Two",
    logoPath: "/channel-logos/bbc-two.svg",
    aliases: ["bbc two", "bbc two hd", "bbctwo"]
  },
  {
    key: "itv1",
    label: "ITV1",
    logoPath: "/channel-logos/itv1.svg",
    aliases: ["itv1", "itv 1", "itv1 hd", "itv hd"]
  },
  {
    key: "channel-4",
    label: "Channel 4",
    logoPath: "/channel-logos/channel-4.svg",
    aliases: ["channel 4", "channel4", "channel 4 hd"]
  },
  {
    key: "e4",
    label: "E4",
    logoPath: "/channel-logos/e4.svg",
    aliases: ["e4", "e4 hd"]
  },
  {
    key: "4seven",
    label: "4seven",
    logoPath: "/channel-logos/4seven.svg",
    aliases: ["4seven"]
  },
  {
    key: "channel-5",
    label: "Channel 5",
    logoPath: "/channel-logos/channel-5.svg",
    aliases: ["channel 5", "channel5", "5", "5 hd"]
  },
  {
    key: "tlc",
    label: "TLC",
    logoPath: "/channel-logos/tlc.svg",
    aliases: ["tlc", "tlc hd"]
  },
  {
    key: "bbc-iplayer",
    label: "BBC iPlayer",
    logoPath: "/channel-logos/bbc-iplayer.svg",
    aliases: ["bbc iplayer"]
  },
  {
    key: "disney-plus",
    label: "Disney+",
    logoPath: "/channel-logos/disney-plus.svg",
    aliases: ["disney plus", "disney+", "disney cine", "disney cine hd", "disney+cinehd"]
  },
  {
    key: "hbo-max",
    label: "HBO Max",
    logoPath: "/channel-logos/hbo-max.svg",
    aliases: ["hbo max"]
  },
  {
    key: "sky-news",
    label: "Sky News",
    logoPath: "/channel-logos/sky-news.svg",
    aliases: ["sky news", "skynews", "sky news hd"]
  },
  {
    key: "sky-atlantic",
    label: "Sky Atlantic",
    logoPath: "/channel-logos/sky-atlantic.svg",
    aliases: ["sky atlantic", "skyatlantic", "sky atlantic hd"]
  },
  {
    key: "sky-witness",
    label: "Sky Witness",
    logoPath: "/channel-logos/sky-witness.svg",
    aliases: ["sky witness", "skywitness", "sky witness hd"]
  },
  {
    key: "sky-showcase",
    label: "Sky Showcase",
    logoPath: "/channel-logos/sky-showcase.svg",
    aliases: ["sky showcase", "skyshowcase", "sky showcase hd", "sky adventure", "sky adventure hd"]
  },
  {
    key: "sky-action",
    label: "Sky Action",
    logoPath: "/channel-logos/sky-action.svg",
    aliases: ["sky action", "sky action hd"]
  },
  {
    key: "sky-cinema",
    label: "Sky Cinema",
    logoPath: "/channel-logos/sky-cinema.svg",
    aliases: ["sky cinema"]
  }
];

const channelBrandsByKey = new Map(channelBrands.map((brand) => [brand.key, brand]));
const channelAliasToKey = new Map(
  channelBrands.flatMap((brand) =>
    brand.aliases.map((alias) => [normalizeChannelLookup(alias), brand.key] as const)
  )
);

function normalizeChannelLookup(value: string) {
  return value
    .trim()
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([A-Za-z])(\d)/g, "$1 $2")
    .replace(/(\d)([A-Za-z])/g, "$1 $2")
    .replace(/&/g, " and ")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .toLowerCase()
    .replace(/\b(lon|london|hd|sd|uhd)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function findChannelBrand({
  channelKey,
  channelName
}: {
  channelKey?: string | null;
  channelName?: string | null;
}) {
  if (channelKey) {
    const exact = channelBrandsByKey.get(channelKey);

    if (exact) {
      return exact;
    }
  }

  if (!channelName) {
    return null;
  }

  const normalized = normalizeChannelLookup(channelName);
  const matchedKey = channelAliasToKey.get(normalized);

  return matchedKey ? channelBrandsByKey.get(matchedKey) ?? null : null;
}

export function getKnownChannelKey(channelName: string | null) {
  return findChannelBrand({ channelName })?.key ?? null;
}
