export const products = [
  {
    id: "ethereal-handchain",
    name: "Ethereal Handchain",
    price: 700,
    description:
      "Materials: Delicate gold-tone chain, crystal accents and floral detailing.\nA graceful handchain featuring a delicate bracelet and finger ring, designed to add an elegant touch to every occasion. Handmade with love, just for you.",
    images: [
      { src: "/ethereal-handchain-1.jpeg", label: "On hand" },
      { src: "/ethereal-handchain-2.jpeg", label: "Bracelet detail" }
    ],
    homePosition: { left: "4%", top: "4%", width: "10%", height: "15%" },
    collectionCell: [0, 0]
  },
  {
    id: "beaded-bracelets",
    name: "Beaded Bracelets (Set of 6)",
    price: 600,
    description:
      "Materials: Multicolored glass-style beads, decorative accents and elastic cord.\nA colorful collection of stackable bracelets, perfect for mixing, matching and expressing your style. Each piece handmade with love.",
    images: [
      { src: "/beaded-bracelets.jpeg", label: "Beaded bracelet set" },
      { src: "/beaded-bracelets-2.jfif", label: "Beaded bracelet detail" }
    ],
    homePosition: { left: "14%", top: "4%", width: "10%", height: "15%" },
    collectionCell: [1, 2]
  },
  {
    id: "moonlace-bracelets",
    name: "Moonlace bracelets",
    price: 400,
    description:
      "Materials: Silver-tone chain, delicate metallic beads and charms.\nDainty layered bracelets with a subtle sparkle, perfect for everyday elegance. Carefully handcrafted with love.",
    images: [
      { src: "/moonlace-1.jpeg", label: "Layered bracelets" },
      { src: "/moonlace-2.jpeg", label: "Bracelet on hand" }
    ],
    homePosition: { left: "24%", top: "4%", width: "10%", height: "15%" },
    collectionCell: [1, 0]
  },
  {
    id: "starfall-earrings",
    name: "Starfall Earrings",
    price: 300,
    description:
      "Materials: Gold-tone metallic beads and pearl accents.\nElegant cascading earrings with a delicate golden shimmer, made to make every moment feel special. Handcrafted with love.",
    images: [
      { src: "/starfall-earrings.jpeg", label: "Starfall earrings" },
      { src: "/starfall-earrings-2.jfif", label: "Starfall earrings detail" }
    ],
    homePosition: { left: "33%", top: "25%", width: "10%", height: "19%" },
    collectionCell: [1, 1]
  },
  {
    id: "joyful-bloom-bracelet",
    name: "Joyful Bloom Bracelet",
    price: 700,
    description:
      "Materials: Colorful floral beads, pearl accents and gold-tone charms.\nA playful floral-inspired bracelet bursting with color and charm. Each detail is thoughtfully handmade with love.",
    images: [
      { src: "/joyful-bloom-1.jpeg", label: "Bracelet on hand" },
      { src: "/joyful-bloom-2.jpeg", label: "Bracelet detail" }
    ],
    homePosition: { left: "44%", top: "4%", width: "10%", height: "15%" },
    collectionCell: [0, 1]
  },
  {
    id: "rainbow-bracelets",
    name: "Rainbow bracelets",
    price: 600,
    description:
      "Materials: Multicolored gemstone-style beads, pearl accents and gold-tone details.\nA beautiful blend of vibrant colors and delicate pearls, bringing a little joy to your wrist. Handmade with love.",
    images: [
      { src: "/rainbow-bracelets.jpeg", label: "Rainbow bracelets" },
      { src: "/rainbow-bracelets-2.jfif", label: "Rainbow bracelets detail" }
    ],
    homePosition: { left: "54%", top: "4%", width: "11%", height: "15%" },
    collectionCell: [2, 0]
  },
  {
    id: "blossom-bracelet",
    name: "Blossom Bracelet",
    price: 400,
    description:
      "Materials: Pink beads, pearl accents, gold-tone details and floral charms.\nInspired by the beauty of blooming flowers, this delicate pink bracelet adds a sweet, feminine touch. Handmade with love.",
    images: [
      { src: "/blossom-bracelet.jpeg", label: "Blossom bracelet" },
      { src: "/blossom-bracelet-2.jfif", label: "Blossom bracelet detail" }
    ],
    homePosition: { left: "65%", top: "4%", width: "13%", height: "15%" },
    collectionCell: [2, 2]
  },
  {
    id: "pearle-bracelet",
    name: "Pearle Bracelet",
    price: 400,
    description:
      "Materials: Pearl beads, gold-tone spacer beads and a decorative charm.\nA timeless pearl bracelet that brings effortless elegance to your everyday look. Carefully handmade with love.",
    images: [
      { src: "/pearle-bracelet-1.jpeg", label: "Pearle bracelet" },
      { src: "/pearle-bracelet-2.jfif", label: "Pearle bracelet detail" }
    ],
    homePosition: { left: "78%", top: "4%", width: "11%", height: "15%" },
    collectionCell: [0, 2]
  },
  {
    id: "lilac-bracelet",
    name: "Lilac Bracelet",
    price: 400,
    description:
      "Materials: Lavender beads, gold-tone accents and decorative charms.\nSoft lilac hues meet delicate golden details in this dreamy bracelet. A little piece of elegance, handmade with love.",
    images: [
      { src: "/lilac-bracelet.jpeg", label: "Lilac bracelet" },
      { src: "/lilac-bracelet-2.jfif", label: "Lilac bracelet detail" }
    ],
    homePosition: { left: "89%", top: "4%", width: "11%", height: "15%" },
    collectionCell: [2, 1]
  }
];

export const productsById = new Map(products.map((product) => [product.id, product]));
