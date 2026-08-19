/* ============================================================
   PRODUCT DATA — the full-detail counterpart to the data-id/name/
   price/image attributes already sitting on each catalog card's "В
   корзину" button (see catalog.html). Those stay the source of truth
   for the catalog grid and cart; this is the extra copy (colors,
   material, description) only the product page needs, keyed by the
   same id so the two never drift apart in what a product is called.
   ============================================================ */

window.LNProducts = [
  {
    id: 'tee-01-blue-gold',
    name: 'Спираль «Синий и золото»',
    price: 4200,
    image: 'assets/products/tee-01-blue-gold.png',
    alt: 'Тай-дай футболка, синий и золотой',
    colors: [
      { label: 'Белый', hex: '#f2ead9' },
      { label: 'Бирюза', hex: '#4fa8ae' },
      { label: 'Горчичный', hex: '#c9a227' },
      { label: 'Тёмно-синий', hex: '#33455f' },
    ],
    description: 'Скручена и окрашена вручную по фирменной технологии — от первого узла до последней капли краски. Пигмент расходится по ткани сам, поэтому рисунок нельзя повторить: даже мастер не знает заранее, каким получится узор.',
  },
  {
    id: 'tee-02-amber-teal',
    name: 'Спираль «Янтарь и бирюза»',
    price: 3900,
    image: 'assets/products/tee-02-amber-teal.png',
    alt: 'Тай-дай футболка, янтарный и бирюзовый',
    colors: [
      { label: 'Белый', hex: '#f2ead9' },
      { label: 'Оранжевый', hex: '#d2691e' },
      { label: 'Бирюза', hex: '#4fb3c4' },
    ],
    description: 'Скручена и окрашена вручную по фирменной технологии — от первого узла до последней капли краски. Пигмент расходится по ткани сам, поэтому рисунок нельзя повторить: даже мастер не знает заранее, каким получится узор.',
  },
  {
    id: 'tee-03-berry-navy',
    name: 'Спираль «Слива и индиго»',
    price: 4400,
    image: 'assets/products/tee-03-berry-navy.png',
    alt: 'Тай-дай футболка, сливовый и индиго',
    colors: [
      { label: 'Белый', hex: '#f2ead9' },
      { label: 'Сливовый', hex: '#5c1a3d' },
      { label: 'Тёмно-синий', hex: '#33455f' },
      { label: 'Лавандовый', hex: '#a99bc1' },
    ],
    description: 'Скручена и окрашена вручную по фирменной технологии — от первого узла до последней капли краски. Пигмент расходится по ткани сам, поэтому рисунок нельзя повторить: даже мастер не знает заранее, каким получится узор.',
  },
  {
    id: 'tee-04-sky-blue',
    name: 'Спираль «Лазурь»',
    price: 3700,
    image: 'assets/products/tee-04-sky-blue.png',
    alt: 'Тай-дай футболка, небесно-голубой',
    colors: [
      { label: 'Белый', hex: '#f2ead9' },
      { label: 'Небесно-голубой', hex: '#29abe2' },
    ],
    description: 'Скручена и окрашена вручную по фирменной технологии — от первого узла до последней капли краски. Пигмент расходится по ткани сам, поэтому рисунок нельзя повторить: даже мастер не знает заранее, каким получится узор.',
  },
];
