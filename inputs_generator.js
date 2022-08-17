const csv = require('csvtojson');
const csvwriter = require('csv-writer');

const createCsvWriter = csvwriter.createObjectCsvWriter;

const csvWriter = createCsvWriter({
    path: 'generated_inputs.csv',
    header: [{ id: 'URL', title: 'URL' }],
});

const main = async () => {
    const records = await csv()
        .fromFile('./inputs.csv')
        .then((jsonObj) => {
            jsonObj.forEach(j => {
                j.URL = j.URL + `?seodebug=T&preview=${new Date().getTime()}`
            });
            return jsonObj;
        });



    await csvWriter
        .writeRecords(records)
        .then(() => console.log('Data uploaded into csv successfully'));
};

main();
