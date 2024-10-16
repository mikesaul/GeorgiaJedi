document.getElementById('dataForm').addEventListener('submit', function(event) {
    event.preventDefault(); // Prevent the default form submission

    // Collect form data
    const type = document.getElementById('type').value;
    const newData = {
        id: document.getElementById('id').value,
        title: document.getElementById('title').value,
        franchise: document.getElementById('franchise').value,
        description: document.getElementById('description').value,
        size: document.getElementById('size').value,
        source: document.getElementById('source').value,
        personalized: document.getElementById('personalized').value,
        is_verified: document.getElementById('is_verified').value,
        serialnumber: document.getElementById('serialnumber').value,
        original_cost: document.getElementById('original_cost').value,
        current_value: document.getElementById('current_value').value,
        image: document.getElementById('image').value
    };

    // Determine the correct JSON file based on the selected type
    const jsonFileName = (type === 'autograph') ? 'autographs.json' : 'collectibles.json';

    // Fetch the existing data from the selected JSON file
    fetch(`data/${jsonFileName}`)
        .then(response => response.json())
        .then(fileData => {
            // Add the new item to the existing data
            fileData.push(newData);

            // Convert the updated data to JSON
            const updatedJson = JSON.stringify(fileData, null, 2);

            // Create a blob from the updated JSON string
            const blob = new Blob([updatedJson], { type: 'application/json' });

            // Create a link element to trigger the download
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = jsonFileName;

            // Append the link to the document body and trigger the download
            document.body.appendChild(a);
            a.click();

            // Clean up
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        })
        .catch(error => {
            console.error(`Error fetching ${jsonFileName}:`, error);
            alert('An error occurred while updating the file.');
        });
});
