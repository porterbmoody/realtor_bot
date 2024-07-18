const fs = require('fs');
const { parse } = require('json2csv');

const data = [
    {
        propertyUrl: 'https://www.redfin.com/FL/Fort-Myers/11674-Russet-Trl-33913/home/177168449',
        price: '$749,000',
        squareFootage: 2361
    },
    {
        propertyUrl: 'https://www.redfin.com/FL/Fort-Myers/921-Jarmilla-Ln-33905/home/61963698',
        price: '$299,000',
        squareFootage: 1631
    }
];

async function saveData() {
    try {
        const fields = ['propertyUrl', 'price', 'squareFootage'];
        const opts = { fields };
        const csv = parse(data, opts);
        fs.writeFileSync("data.csv", csv);
        console.log('CSV file saved successfully.');
    } catch (error) {
        console.error('Error saving CSV file:', error);
    }
}

saveData();
