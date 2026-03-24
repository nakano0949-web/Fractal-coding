

This repository contains an interactive demonstration of a fractal-based image encoding system built on a ±1 Möbius Iterated Function System (IFS).  
The goal is not traditional compression, but structural analysis: extracting self-similarity, visualizing symbolic dynamics, and revealing how image regions correspond to nonlinear transformations.

The demo includes:

- Quad-tree partitioning based on approximation error  
- σ-codes (±1 sequences) representing IFS compositions  
- α-coefficients computed via least-squares fitting  
- A σ-map that visualizes structural codes as color  
- A reconstruction panel using the encoded parameters  
- A limit set visualization showing the pure IFS dynamics  

Everything is implemented with minimal HTML/CSS/JS and no external dependencies.

---

How It Works

1. Quad-tree Partition
The image is recursively subdivided.  
If a region can be approximated well by an IFS-transformed basis patch, it remains large; otherwise it splits into four smaller regions.

2. σ-code Assignment
For each patch, the system searches over ±1 sequences up to a maximum length.  
Each sequence σ corresponds to a Möbius transformation:

\[
M_+(x)=\frac{x+2}{x+1},\quad
M_-(x)=\frac{x}{x-1}
\]

The best σ is chosen by minimizing reconstruction error.

3. α-coefficient
Given σ, the optimal scaling factor α is computed by:

\[
\alpha = \frac{\langle P, \phi\sigma \rangle}{\langle \phi\sigma, \phi_\sigma \rangle}
\]

where \( \phi_\sigma \) is the transformed basis patch.

4. σ-map (Structure Map)
Each patch is colored using:

- Hue = binary value of σ  
- Saturation = depth of σ  
- Value = inverse of approximation error  

This produces a fractal-like color pattern that reflects the symbolic structure of the image.

5. Reconstruction
The image is reconstructed patch-by-patch using:

\[
\tilde{P}(x,y) = \alpha \, \phi_\sigma(x,y)
\]

6. Limit Set Visualization
The ±1 IFS has a nontrivial limit set.  
This panel plots many points of the form:

\[
x\sigma = M\sigma(x_0)
\]

colored using the same σ-map rules.  
This reveals the pushforward measure of the IFS and shows how the symbolic structure relates to the pure mathematical dynamics.

---

Why This Matters

This system is useful for:

- Understanding self-similarity in images  
- Studying nonlinear dictionary learning  
- Connecting real data to IFS theory  
- Visualizing symbolic dynamics  
- Exploring fractal geometry in a concrete way  

It provides a structural representation that classical compression methods cannot offer.

---

Features

- Interactive quad-tree visualization  
- Real-time σ-map rendering  
- Full reconstruction from σ and α  
- Limit set visualization  
- Minimal, dependency-free implementation  

---

Project Structure

`
index.html   # UI layout
style.css    # minimal visual design
main.js      # full algorithm + rendering
`

---

Live Demo

(Add your GitHub Pages link here)

---

License

MIT License.

---
