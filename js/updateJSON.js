document.addEventListener('DOMContentLoaded', function () {
    function getQueryParameter(param) {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get(param);
    }

    const itemType = getQueryParameter('itemType');
    const itemId = getQueryParameter('id');
    const referrer = document.referrer;

    function getOrderedData(form, itemType) {
        return {
            id: form.id.value,
            acquired: form.acquired.value,
            type: itemType || form.itemType?.value || '',
            "name/brand": form.title.value,
            franchise: form.franchise.value,
            description: form.description.value,
            "size/model#": form.size.value,
            source: form.source.value,
            special: form.personalized.value,
            is_verified: form.is_verified.value,
            serialnumber: form.serialnumber.value,
            original_cost: form.original_cost.value,
            current_value: form.current_value.value,
            image: form.image.value
        };
    }

    if (itemId && itemType) {
        const jsonFileName = `data/${itemType}.json`;

        fetch(jsonFileName)
            .then(response => response.json())
            .then(fileData => {
                const item = fileData.find(item => item.id == itemId);
                if (item) {
                    const form = document.getElementById('dataForm');
                    form.id.value = item.id;
                    form.acquired.value = item.acquired;
                    form.title.value = item['name/brand'];
                    form.franchise.value = item.franchise;
                    form.description.value = item.description;
                    form.size.value = item['size/model#'];
                    form.source.value = item.source;
                    form.personalized.value = item.special;
                    form.is_verified.value = item.is_verified;
                    form.serialnumber.value = item.serialnumber;
                    form.original_cost.value = item.original_cost;
                    form.current_value.value = item.current_value;
                    form.image.value = item.image;
                } else {
                    alert('Item not found!');
                }
            })
            .catch(error => {
                console.error(`Error fetching ${jsonFileName}:`, error);
                alert('An error occurred while fetching the item.');
            });

        document.getElementById('dataForm').addEventListener('submit', function (event) {
            event.preventDefault();

            const form = event.target;
            const updatedData = getOrderedData(form, itemType);

            fetch(jsonFileName)
                .then(response => response.json())
                .then(fileData => {
                    const index = fileData.findIndex(item => item.id == itemId);
                    if (index !== -1) {
                        fileData[index] = updatedData;

                        const updatedJson = JSON.stringify(fileData, null, 2);
                        const blob = new Blob([updatedJson], { type: 'application/json' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = jsonFileName.replace('data/', '');

                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);

                        alert('Item updated successfully!');
                        setTimeout(() => {
                            window.location.href = referrer || 'index.html';
                        }, 500);
                    } else {
                        alert('Item not found in file!');
                    }
                })
                .catch(error => {
                    console.error(`Error updating ${jsonFileName}:`, error);
                    alert('An error occurred while updating the item.');
                });
        });

    } else {
        document.getElementById('itemType').addEventListener('change', function () {
            const itemType = this.value;
            const jsonFileName = `data/${itemType}.json`;

            fetch(jsonFileName)
                .then(response => response.json())
                .then(fileData => {
                    let maxId = fileData.reduce((max, item) => Math.max(max, parseInt(item.id, 10)), 0);
                    document.getElementById('id').value = maxId + 1;
                })
                .catch(error => {
                    console.error(`Error fetching ${jsonFileName}:`, error);
                    alert('An error occurred while fetching the file.');
                });
        });

        document.getElementById('dataForm').addEventListener('submit', function (event) {
            event.preventDefault();

            const form = event.target;
            const itemType = form.itemType.value;
            const jsonFileName = `data/${itemType}.json`;
            const newData = getOrderedData(form, itemType);

            fetch(jsonFileName)
                .then(response => response.json())
                .then(fileData => {
                    fileData.push(newData);
                    const updatedJson = JSON.stringify(fileData, null, 2);

                    const blob = new Blob([updatedJson], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = jsonFileName.replace('data/', '');

                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);

                    alert('Item added successfully!');
                    setTimeout(() => {
                        window.location.href = referrer || 'index.html';
                    }, 500);
                })
                .catch(error => {
                    console.error(`Error updating ${jsonFileName}:`, error);
                    alert('An error occurred while updating the file.');
                });
        });
    }
});
