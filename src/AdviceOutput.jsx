import React from 'react';

export default function AdviceOutput({ items, className = '' }) {
  return (
    <section className={`results mainResults adviceOutput ${className}`.trim()}>
      {items.map((item) => (
        <div className="resultCard" key={item.title}>
          <h3>{item.title}</h3>
          <strong>{item.value}</strong>
          {item.text && <p>{item.text}</p>}
        </div>
      ))}
    </section>
  );
}
