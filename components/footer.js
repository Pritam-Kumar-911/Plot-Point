async function loadFooter() {
    const response = await fetch("components/footer.html");
    const html = await response.text();
    document.getElementById("footer").innerHTML = html;
}