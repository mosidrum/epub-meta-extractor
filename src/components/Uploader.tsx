import React, { useState } from 'react';
import JSZip from 'jszip';
import ePub from 'epubjs';
import styles from './uploader.module.css';

interface Metadata {
  [key: string]: any;
}

export const Uploader = () => {
  const [metadata, setMetadata] = useState<Metadata | null>(null);
  const [imageData, setImageData] = useState<{ [key: string]: string }>({});

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (e) => {
        if (e.target && e.target.result) {
          try {
            const arrayBuffer = e.target.result as ArrayBuffer;
            const zip = new JSZip();
            const loadedZip = await zip.loadAsync(arrayBuffer);
            const content = await loadedZip.file("META-INF/container.xml")?.async("string");

            if (!content) {
              throw new Error("Invalid EPUB file: Missing container.xml");
            }

            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(content, "text/xml");
            const rootFile = xmlDoc.getElementsByTagName("rootfile")[0];
            const rootPath = rootFile.getAttribute("full-path") || "";

            const rootFileContent = await loadedZip.file(rootPath)?.async("string");

            if (!rootFileContent) {
              throw new Error(`Invalid EPUB file: Missing ${rootPath}`);
            }

            const metadataXmlDoc = parser.parseFromString(rootFileContent, "text/xml");
            const metadataNode = metadataXmlDoc.getElementsByTagName("metadata")[0];
            const manifestNode = metadataXmlDoc.getElementsByTagName("manifest")[0];

            const extractedMetadata: Metadata = {};
            const metadataElements = metadataNode.children;

            for (let i = 0; i < metadataElements.length; i++) {
              const element = metadataElements[i] as HTMLElement;
              const tagName = element.tagName;
              const textContent = element.textContent;
              extractedMetadata[tagName] = textContent;
            }

            // console.log('Extracted Metadata:', extractedMetadata);
            setMetadata(extractedMetadata);

            const images: { [key: string]: string } = {};
            const itemNodes = manifestNode.getElementsByTagName("item");

            for (let i = 0; i < itemNodes.length; i++) {
              const itemNode = itemNodes[i];
              const href = itemNode.getAttribute("href");
              const mediaType = itemNode.getAttribute("media-type");
              if (mediaType?.startsWith("image/") && href) {
                const base64Content = await loadedZip.file(href)?.async("base64");
                if (base64Content) {
                  images[href] = base64Content;
                }
              }
            }

            // console.log('Extracted Images:', images);
            setImageData(images);

          } catch (error) {
            console.error('Error processing EPUB file:', error);
          }
        }
      };
      reader.readAsArrayBuffer(file);
    }
  };

  return (
    <div className={styles.container}>
      <h1>EPUB Metadata Extractor</h1>
      <input type="file" accept=".epub" onChange={handleFileUpload} />
      {metadata && (
        <div>
          <h2>Book Metadata</h2>
          <ul>
            {Object.entries(metadata).map(([key, value]) => (
              <li key={key}>
                <strong>{key}:</strong> {value}
              </li>
            ))}
          </ul>
        </div>
      )}
      {Object.entries(imageData).length > 0 && (
        <div>
          <h2>Book Image</h2>
          {Object.keys(imageData).map((image, index) => (
            index === 0 && (
              <div key={index}>
                <img src={`data:image/jpeg;base64,${imageData[image]}`} alt="First Image" />
              </div>
            )
          ))}
        </div>
      )}
    </div>
  );
};
