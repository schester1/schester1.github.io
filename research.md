---
layout: page
title: Research
---
<h3 id="1">Paleo Sea Level and Glacial Isostatic Adjustment</h3>

The rate of modern sea level rise is spatially and temporally variable. One of the processes driving these spatial patterns is Glacial Isostatic Adjustment (GIA): deformation of Earth's solid surface, geoid and rotational axis due to changes in ice and ocean load. 

<h4 id="1">Mid-Holocene sea-level </h4>

<!-- <p><span class="image right"><img src="assets/images/QSR_Paper_Fig_1.png" alt="" /></span> -->

<p><span class="image right" style="max-width: 700px; float: right; margin: 0 0 1em 1.5em;"><img src="assets/images/QSR_Paper_Fig_1.png" alt="" /></span>



GIA drove spatially variable sea-level change along Northern Hemisphere coastlines during the Holocene. Near the margins of former ice sheets is a unique pattern of change characterised by sea level fall interrupted by a brief (1-3 kyr) period of rise, or transgression. The origins of this mid-Holocene transgression have been previously debated. We used a suite of GIA model simulations to show that the transgression was likely driven by a geodynamics process that we term 'reverse migration' of the peripheral bulge. We show how this previously unidentified process arises from a contrast in viscosity between Earth's upper and lower mantle. Finally, we use observations of the transgression to constrain this contrast in viscosity below the former Laurentide and Fennoscandian ice sheets. This work is published in Quaternary Science Reviews  <a href="https://doi.org/10.1016/j.quascirev.2024.108986">(Chester et al., 2024)</a>.

</p>

<h4 id="1">FastGIA: a GIA model in Julia </h4>

<p>GIA models are available in a number of programming languages and from multiple research groups. We (Roger Creel and I) translated a 1D GIA model originally written in Matlab by Jacqueline Austermann to the Julia Programming Language to gain some speed and efficiency. Please reach out if you are interested in using the GIA code!</p>


<h3 id="1">Bayesian Data-Model Assimilation Ice Sheet Reconstructions</h3>

<p><span class="image right" style="max-width: 400px; float: right; margin: 0 0 1em 1.5em;"><img src="assets/images/Isochrons_Fig.jpg" alt="" /></span>


<p>Reconstructing past ice sheet extent allows us to investigate the drivers of deglaciation and helps us understand the (in)stability of the modern Greenland and Antarctic Ice Sheets. These reconstructions typically use geomorphic mapping and geochronology (cosmogenic nuclide and radiocarbon dating) to determine past extent. Alternatively, physics-based models of ice flow provide reconstructions of deglaciation. My work seeks to bridge these approaches and to quantify the uncertainty of paleo-ice extent using a Bayesian framework. Our data-Assimilation-based Laurentide Ice Sheet reconstruction (ALIS) provides a probabilistic model for ice margin extent over the deglaciation. By comparing to paleoclimate proxies and surficial geology, we find that the rates of Laurentide Ice Sheet collapse were largely dictated by the distribution of soft basal sediment, which allowed for fast flowing ice (ice streams) to develop and initiated a positive feedback of ice loss. This work is under review at Science Advances. </p>
<p>
ALIS has the ability to predict deglaciation time across North America with quantified uncertainty. I built this tool to extract a deglaciation age from any location within the LIS extent. The full ALIS posterior is openly available <a href="{{ 'deglaciation' | absolute_url }}">here</a>.  
</p>


<h3 id="1">Feedbacks between GIA and Marine-based Ice Sheets</h3>

<p>Ice sheets are highly sensitive to changes in topography and relative sea level. As ice sheets grow and shrink they change the local topography and gravity field both of which modulate relative sea level. Such effects can result in critical feedbacks between GIA and ice sheet dynamics, notably the possible stabilization of the grounding line during ice mass loss. 
I developed a new coupled model to further understand how these modeling decisions influence the predicted dynamics and ultimately our understanding of ice sheet-sea level interaction. I coupled a widely used GIA model with the open-source, thermomechanical Parallel Ice Sheet Model (PISM). The GIA model solves the ‘sea level equation’, assumes a 1D maxwell viscoelastic Earth structure and accounts for rotational feedbacks. </p>

<p> I am currently using this model to investigate the driver of Antarctic deglaciation during the Last Interglacial (122-116 ka), a period when Earth's climate and ocean were warmer than present. I ran transient simulations over the last two glacial cycles with a range of forcings and ice sheet/GIA model parameters. Initial results show that the early stage of WAIS deglaciation is driven by rising global mean sea level; however, the extent of retreat/collapse during the LIG is controlled by the peak sub-ice-shelf ocean temperature anomaly. 
I am currently preparing this work for submission.  </p>

<h3 id="1">Modern thinning and associated isostatic uplift of the Juneau Icefield</h3>

<p>Alaskan glaciers are thinning at an alarming rate (Berthier et al. 2010). Among them, the Juneau Icefield has been melting at an accelerating rate since the Little Ice Age (Davies et al., 2024). To better understand this thinning and how it drives GIA and local sea-level changes, we conducted a repeat GPS survey in 2025 to reoccupy sites originally measured in the early 1990s. I led this work as part of my teaching faculty role at the <a href="https://www.juneauicefield.org/">Juneau Icefield Research Program</a>. The survey was largely driven by the incredible work of the students. 
We found average uplift rates of 2.1 and 2.5 cm/yr at two sites over the period 1992 to 2025. These are the first measurements of isostatic rebound taken directly on the JIF and they are higher than predicted by previously published models. This underscores the importance of campaign surveys to monitor uplift near melting icefield rather than relying on permenant installations near towns and cities.</p>

<p>JIRP has been conducting GPS surveys of glacier surface elevation (relative to bedrock) since the early 1990s, led largely by researcher <a href="http://crevassezone.org/">Scott McGee</a>. These data are unevenly distributed in both time and space, yet they provide remarkable coverage of the southern half of the icefield. This has a number of advantages over remote sensing data which are generally noise on the upper accumulation zone. I used a Bayesian framework to derive a model a spatiotemporal field of surface change with quantified uncertainty. The statistical model shows accelerating surface lowering over the last few decades. We also find a strong spatial gradient with the majority of the lowering occurring on the eastern interior portion of the icefield. </p>


<h3 id="1">SWAIS2C: Sensitivity of the West Antarctic Ice Sheet to 2 degrees C of Warming</h3>

<p>The <a href="https://swais2c.aq/">SWAIS2C</a> project is an international collaboration that seeks to understand the sensitivity of the West Antarctic Ice Sheet to the 1.5 to 2 degrees C warming target set by the Paris Agreement. By investigating the subglacial geologic record, we hope to understand how the ice sheet responded to past periods of warming. I participated in the last field campaign ('25-26) on the Antarctic Ice sheet where I deployed a radar system (Autonomous-phase Radio Echo Sounder) and aided in a seismic survey to understand the englacial and subglacial environment around the drill location. Additionally, I will work with the core team and provide modeling results that can help interpret the geologic data. </p>