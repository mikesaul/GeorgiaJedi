document.addEventListener('DOMContentLoaded', function() {
    // Helper function to get query string parameters
    function getQueryParameter(param) {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get(param);
    }

    const itemType = getQueryParameter('itemType');
    const itemId = getQueryParameter('ID');

    if (itemId && itemType) {
        // Update Item logic
        const jsonFileName = `data/${itemType}.json`;

        // Fetch the item data from the JSON file to update the form
        fetch(jsonFileName)
            .then(response => response.json())
            .then(fileData => {
                const item = fileData.find(item => item.id == itemId);

                if (item) {
                    // Populate the form fields with the item's data
                    document.getElementById('id').value = item.id;
                    document.getElementById('title').value = item['name/brand']; // Adjusted key to match JSON
                    document.getElementById('franchise').value = item.franchise;
                    document.getElementById('description').value = item.description;
                    document.getElementById('size').value = item['size/model#']; // Adjusted key
                    document.getElementById('source').value = item.source;
                    document.getElementById('personalized').value = item.special;
                    document.getElementById('is_verified').value = item.is_verified;
                    document.getElementById('serialnumber').value = item.serialnumber;
                    document.getElementById('original_cost').value = item.original_cost;
                    document.getElementById('current_value').value = item.current_value;
                    document.getElementById('image').value = item.image;

                    // Populate the acquired date
                    document.getElementById('acquired').value = item.acquired; // New acquired field
                } else {
                    alert('Item not found!');
                }
            })
            .catch(error => {
                console.error(`Error fetching ${jsonFileName}:`, error);
                alert('An error occurred while fetching the item.');
            });

        // Form submission for updating the item
        document.getElementById('dataForm').addEventListener('submit', function(event) {
            event.preventDefault(); // Prevent default form submission

            const updatedData = {
                id: document.getElementById('id').value,
                'name/brand': document.getElementById('title').value, // Adjusted key
                franchise: document.getElementById('franchise').value,
                description: document.getElementById('description').value,
                'size/model#': document.getElementById('size').value, // Adjusted key
                source: document.getElementById('source').value,
                special: document.getElementById('personalized').value,
                is_verified: document.getElementById('is_verified').value,
                serialnumber: document.getElementById('serialnumber').value,
                original_cost: document.getElementById('original_cost').value,
                current_value: document.getElementById('current_value').value,
                image: document.getElementById('image').value,
                acquired: document.getElementById('acquired').value // New acquired field
            };

            // Fetch the original data and update the selected item
            fetch(jsonFileName)
                .then(response => response.json())
                .then(fileData => {
                    const itemIndex = fileData.findIndex(item => item.id == itemId);
                    
                    if (itemIndex !== -1) {
                        fileData[itemIndex] = updatedData; // Update the item

                        const updatedJson = JSON.stringify(fileData, null, 2);
                        const blob = new Blob([updatedJson], { type: 'application/json' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = jsonFileName.replace('data/', ''); // Save file without data/ prefix

                        document.body.appendChild(a);
                        a.click();

                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);

                        alert('Item updated successfully!');
                    } else {
                        alert('Item not found in the file!');
                    }
                })
                .catch(error => {
                    console.error(`Error updating ${jsonFileName}:`, error);
                    alert('An error occurred while updating the item.');
                });
        });
    } else {
        // Add Item logic

        document.getElementById('itemType').addEventListener('change', function() {
            const itemType = this.value;
            if (itemType) {
                const jsonFileName = `data/${itemType}.json`; // Construct the filename dynamically

                // Fetch the data to determine the highest ID
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
            }
        });

        document.getElementById('dataForm').addEventListener('submit', function(event) {
            event.preventDefault(); // Prevent the default form submission

            const itemType = document.getElementById('itemType').value;
            const jsonFileName = `data/${itemType}.json`;

            const newData = {
                id: document.getElementById('id').value,
                'name/brand': document.getElementById('title').value, // Adjusted key
                franchise: document.getElementById('franchise').value,
                description: document.getElementById('description').value,
                'size/model#': document.getElementById('size').value, // Adjusted key
                source: document.getElementById('source').value,
                special: document.getElementById('personalized').value,
                is_verified: document.getElementById('is_verified').value,
                serialnumber: document.getElementById('serialnumber').value,
                original_cost: document.getElementById('original_cost').value,
                current_value: document.getElementById('current_value').value,
                image: document.getElementById('image').value,
                acquired: document.getElementById('acquired').value // New acquired field
            };

            fetch(jsonFileName)
                .then(response => response.json())
                .then(fileData => {
                    fileData.push(newData);
                    const updatedJson = JSON.stringify(fileData, null, 2);

                    const blob = new Blob([updatedJson], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = jsonFileName.replace('data/', ''); // Download without the data/ prefix

                    document.body.appendChild(a);
                    a.click();

                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                })
                .catch(error => {
                    console.error(`Error fetching ${jsonFileName}:`, error);
                    alert('An error occurred while updating the file.');
                });
        });
    }
});
