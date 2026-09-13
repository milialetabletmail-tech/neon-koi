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
    name: '«Малахит»',
    price: 4200,
    technique: 'cold',
    image: 'assets/products/tee-01-blue-gold.png',
    images: [
      'assets/products/tee-01-blue-gold.png',
      'assets/products/tee-01-blue-gold-back.png',
      'assets/products/tee-01-blue-gold-mannequin-front.png',
      'assets/products/tee-01-blue-gold-mannequin-back.png',
    ],
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
    name: '«Лето»',
    price: 3900,
    technique: 'warm',
    image: 'assets/products/tee-02-amber-teal.png',
    images: [
      'assets/products/tee-02-amber-teal.png',
      'assets/products/tee-02-amber-teal-back.png',
      'assets/products/tee-02-amber-teal-mannequin-front.png',
      'assets/products/tee-02-amber-teal-mannequin-back.png',
    ],
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
    name: '«Медуза»',
    price: 4400,
    technique: 'cold',
    image: 'assets/products/tee-03-berry-navy.png',
    images: [
      'assets/products/tee-03-berry-navy.png',
      'assets/products/tee-03-berry-navy-back.png',
      'assets/products/tee-03-berry-navy-mannequin-front.png',
      'assets/products/tee-03-berry-navy-mannequin-back.png',
    ],
    alt: 'Тай-дай футболка, сливовый и индиго',
    colors: [
      { label: 'Белый', hex: '#f2ead9' },
      { label: 'Сливовый', hex: '#4d1533' },
      { label: 'Тёмно-синий', hex: '#33455f' },
      { label: 'Лавандовый', hex: '#a99bc1' },
    ],
    description: 'Скручена и окрашена вручную по фирменной технологии — от первого узла до последней капли краски. Пигмент расходится по ткани сам, поэтому рисунок нельзя повторить: даже мастер не знает заранее, каким получится узор.',
  },
  {
    id: 'tee-04-sky-blue',
    name: '«Лазурь»',
    price: 3700,
    technique: 'warm',
    image: 'assets/products/tee-04-sky-blue.png',
    images: [
      'assets/products/tee-04-sky-blue.png',
      'assets/products/tee-04-sky-blue-back.png',
      'assets/products/tee-04-sky-blue-mannequin-front.png',
      'assets/products/tee-04-sky-blue-mannequin-back.png',
    ],
    alt: 'Тай-дай футболка, небесно-голубой',
    colors: [
      { label: 'Белый', hex: '#f2ead9' },
      { label: 'Небесно-голубой', hex: '#29abe2' },
    ],
    description: 'Скручена и окрашена вручную по фирменной технологии — от первого узла до последней капли краски. Пигмент расходится по ткани сам, поэтому рисунок нельзя повторить: даже мастер не знает заранее, каким получится узор.',
  },
  {
    id: 'tee-05-raspberry',
    name: '«Малинка»',
    price: 4000,
    technique: 'warm',
    image: 'assets/products/tee-05-raspberry.png',
    images: [
      'assets/products/tee-05-raspberry.png',
      'assets/products/tee-05-raspberry-back.png',
      'assets/products/tee-05-raspberry-mannequin-front.png',
      'assets/products/tee-05-raspberry-mannequin-back.png',
    ],
    alt: 'Тай-дай футболка «Малинка», малиновый и сливовый',
    colors: [
      { label: 'Светло-розовый', hex: '#f5c3d7' },
      { label: 'Малиновый', hex: '#c8195c' },
      { label: 'Сливовый', hex: '#4d1533' },
    ],
    description: 'Скручена и окрашена вручную по фирменной технологии — от первого узла до последней капли краски. Пигмент расходится по ткани сам, поэтому рисунок нельзя повторить: даже мастер не знает заранее, каким получится узор.',
  },
];
