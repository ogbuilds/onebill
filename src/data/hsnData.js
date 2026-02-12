export const COMMON_HSN_CODES = [
    { code: '998311', description: 'Management consulting and management services' },
    { code: '998312', description: 'Business consulting services' },
    { code: '998313', description: 'Information technology (IT) consulting and support services' },
    { code: '998314', description: 'Information technology (IT) design and development services' },
    { code: '998315', description: 'Hosting and information technology (IT) infrastructure provisioning services' },
    { code: '998316', description: 'IT network management services' },
    { code: '998319', description: 'Other information technology services n.e.c' },
    { code: '998211', description: 'Legal advisory and representation services' },
    { code: '998221', description: 'Financial auditing services' },
    { code: '998222', description: 'Accounting and bookkeeping services' },
    { code: '998711', description: 'Maintenance and repair services of fabricated metal products' },
    { code: '998712', description: 'Maintenance and repair services of office and accounting machinery' },
    { code: '998713', description: 'Maintenance and repair services of computers and peripheral equipment' },
    { code: '995411', description: 'Construction services of single dwelling or multi dwelling or multi-storied residential buildings' },
    { code: '995412', description: 'Construction services of industrial buildings' },
    { code: '995413', description: 'Construction services of commercial buildings' },
    { code: '996311', description: 'Room or unit accommodation services' },
    { code: '996332', description: 'Meal serving services in full-service restaurants & canteens' },
    { code: '997212', description: 'Real estate services involving own or leased non-residential property' },
    { code: '996711', description: 'Container handling services' },
    { code: '996719', description: 'Cargo handling services other than container handling' },
    { code: '996111', description: 'Services of wholesale trade' },
    { code: '996211', description: 'Services of retail trade' },
    { code: '8471', description: 'Automatic data processing machines and units' },
    { code: '8517', description: 'Telephone sets, including smartphones' },
    { code: '8528', description: 'Monitors and projectors' },
    { code: '9403', description: 'Other furniture and parts' },
    { code: '4820', description: 'Registers, account books, note books' },
    { code: '4901', description: 'Printed books, brochures, leaflets' },
    { code: '6109', description: 'T-shirts, singlets and other vests, knitted or crocheted' },
    { code: '6203', description: 'Men\'s or boys\' suits, ensembles, jackets, blazers, trousers' },
    { code: '6204', description: 'Women\'s or girls\' suits, ensembles, jackets, blazers, dresses' }
];

export const searchHSN = (query) => {
    if (!query) return [];
    const lowerQuery = query.toLowerCase();
    return COMMON_HSN_CODES.filter(item =>
        item.code.includes(lowerQuery) ||
        item.description.toLowerCase().includes(lowerQuery)
    );
};
