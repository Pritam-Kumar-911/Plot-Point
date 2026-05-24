const Api_key = "16ede4510682a36d922e989774c6d98a"
async function getData() {
  try {
    const response = await fetch(`https://api.themoviedb.org/3/movie/top?api_key=${Api_key}`);

    if (!response.ok) {
      throw new Error("HTTP error! Status: " + response.status);
    }

    const data = await response.json();
    console.log("API Data:", data);

  } catch (error) {
    console.error("Error:", error);
  }
}

getData();