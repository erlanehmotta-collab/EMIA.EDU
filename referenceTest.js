async function testRef() {
  const doi = "10.1038/nrg3270";
  const url = `https://doi.org/${doi}`;
  
  try {
    const response = await fetch(url, {
        headers: {
            "Accept": "text/x-bibliography; style=associacao-brasileira-de-normas-tecnicas"
        },
        redirect: 'follow'
    });
    
    if (response.ok) {
        const data = await response.text();
        console.log("ABNT:", data.trim());
    }
  } catch (err) {
    console.error(err);
  }
}

testRef();
