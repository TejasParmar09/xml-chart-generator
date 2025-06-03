export const extractFields = async (xmlString) => {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlString, 'text/xml');
  const items = xmlDoc.getElementsByTagName('item');
  const fields = new Set();

  for (let i = 0; i < items.length; i++) {
    const children = items[i].children;
    for (let j = 0; j < children.length; j++) {
      fields.add(children[j].tagName);
    }
  }

  const allFields = Array.from(fields).map((field) => ({
    value: field,
    label: field.charAt(0).toUpperCase() + field.slice(1),
  }));

  return { allFields };
};