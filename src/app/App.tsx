import { useState, useEffect, useRef, useCallback } from "react";
import { HowItWorks, MissionFooter } from "./components/LandingSections";
import { FIREBASE_READY, auth, db, googleProvider, config } from "../lib/firebase";
import {
  onAuthStateChanged, signInWithPopup, signOut as fbSignOut,
  updateProfile,
  type User as FbUser,
} from "firebase/auth";
import {
  collection, addDoc, onSnapshot, query, orderBy, limit,
  runTransaction, serverTimestamp, doc, setDoc, getDoc, updateDoc, increment, deleteDoc,
} from "firebase/firestore";
import { motion } from "motion/react";
import ecoAlertLogo from "../imports/Idk.jpeg";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  MapPin, Camera, AlertTriangle, Leaf, Trophy, BookOpen,
  Home, Bell, Search, Upload, Send, CheckCircle, Clock,
  Users, FileCheck, Menu, X, Trash2, Flame, Droplets,
  Wind, Package, Shield, Target, Eye, Calendar,
  Recycle, Filter, Star, ChevronRight, Zap, AlertCircle,
  Cpu, Info, Settings, ExternalLink, Sparkles, Globe, Heart,
} from "lucide-react";

// ==================== TYPES ====================

type Page = "home" | "report" | "analysis" | "map" | "alerts" | "gamification" | "education" | "admin" | "community" | "account";
type Theme = "light" | "dark" | "system";

interface GoogleUser {
  uid: string;
  name: string;
  email: string;
  photoUrl: string;
}

interface UserStats {
  points: number;
  reports: number;
  resolved: number;
  badges: string[];
  level: string;
  levelNum: number;
}

type ReportType = "basura" | "quema" | "aguas" | "escombros" | "aire" | "otros";
type Severity = "bajo" | "medio" | "alto";
type ReportStatus = "pendiente" | "proceso" | "resuelto";
type AlertType = "limpieza" | "reciclaje" | "residuos" | "arboles" | "evento";
type ArticleCategory = "reciclaje" | "residuos" | "agua" | "contaminacion" | "clima";

interface Report {
  id: string; type: ReportType; severity: Severity; status: ReportStatus;
  description: string; location: string; sector: string; date: string;
  user: string; votes: number; imageUrl: string;
  lat: number; lng: number;
}

interface SubmittedReport {
  id: string;
  type: ReportType;
  description: string;
  imageUrl: string | null;
  location: string;
  lat: number | null;
  lng: number | null;
  date: string;
  time: string;
  upvotes: number;
  userName: string;
  userPhoto: string | null;
  status?: ReportStatus;
}

interface EcoAlert {
  id: string; title: string; type: AlertType; date: string; time: string;
  location: string; description: string; participants: number; maxParticipants: number;
}

interface CitizenUser {
  id: string; name: string; points: number; level: string; levelNum: number;
  reports: number; resolved: number; sector: string; badges: string[]; avatar: string;
}

interface Article {
  id: string; title: string; category: ArticleCategory; summary: string;
  readTime: number; date: string; imageUrl: string; views: number;
  source?: string; tags?: string[];
}

interface TrustedSource {
  name: string; full: string; url: string; desc: string; color: string; logo: string;
}

interface NewsItem {
  id: string;
  title: string;
  source: string;
  date: string;
  summary: string;
  imageUrl: string;
  url: string;
  tag: string;
  tagColor: string;
}

// ==================== CONSTANTS ====================

const DEFAULT_STATS: UserStats = {
  points: 0, reports: 0, resolved: 0,
  badges: [], level: "Eco Novato", levelNum: 1,
};

// Hero slideshow — Lima / Peru city scenes from Unsplash
const HERO_IMAGES = [
  "https://images.unsplash.com/photo-1715484955021-3432e88eba99?w=1600&h=700&fit=crop&q=80",
  "https://images.unsplash.com/photo-1613612904637-dca0b7f316f4?w=1600&h=700&fit=crop&q=80",
  "https://images.unsplash.com/photo-1508958156594-61260a92449e?w=1600&h=700&fit=crop&q=80",
  "https://images.unsplash.com/photo-1535479672101-8486af672be0?w=1600&h=700&fit=crop&q=80",
  "https://images.unsplash.com/photo-1715484954989-f8f11d74e1a0?w=1600&h=700&fit=crop&q=80",
];

// ==================== HELPERS ====================

function computeLevel(points: number): { level: string; levelNum: number } {
  if (points >= 2500) return { level: "Eco Héroe", levelNum: 4 };
  if (points >= 1500) return { level: "Eco Guardián", levelNum: 3 };
  if (points >= 500) return { level: "Eco Protector", levelNum: 2 };
  return { level: "Eco Novato", levelNum: 1 };
}

function computeBadges(stats: UserStats): string[] {
  const badges = [...stats.badges];
  const add = (b: string) => { if (!badges.includes(b)) badges.push(b); };
  if (stats.reports >= 1) add("primer_reporte");
  if (stats.reports >= 10) add("diez_reportes");
  if (stats.resolved >= 5) add("resolutor");
  if (stats.reports >= 3) add("activo");
  return badges;
}

// ==================== MOCK DATA ====================

const REPORTS: Report[] = [
  {
    id: "R-2026-001", type: "basura", severity: "alto", status: "pendiente",
    description: "Acumulación masiva de residuos sólidos en la esquina de Av. Pastor Sevilla con Jr. Los Algarrobos. Los vecinos llevan 3 días reportando el problema sin respuesta municipal.",
    location: "Av. Pastor Sevilla con Jr. Los Algarrobos", sector: "Sector 3",
    date: "2026-08-20", user: "María García", votes: 24,
    imageUrl: "https://images.unsplash.com/photo-1662534264036-7bfa0d35de9c?w=400&h=250&fit=crop&q=80",
    lat: -12.2012, lng: -76.9340,
  },
  {
    id: "R-2026-002", type: "quema", severity: "alto", status: "proceso",
    description: "Quema de residuos sólidos a campo abierto generando humo tóxico. Afecta a familias del sector y niños del colegio Tupac Amaru II.",
    location: "Jr. Los Eucaliptos Mz. 15, Lt. 3", sector: "Sector 6",
    date: "2026-08-19", user: "Carlos Quispe", votes: 18,
    imageUrl: "https://images.unsplash.com/photo-1631174755309-39c5cd515636?w=400&h=250&fit=crop&q=80",
    lat: -12.2218, lng: -76.9295,
  },
  {
    id: "R-2026-003", type: "aguas", severity: "medio", status: "proceso",
    description: "Desagüe colapsado genera aguas servidas en la vía pública. El olor es insoportable y representa un riesgo sanitario para los vecinos.",
    location: "Av. Separadora Industrial Km 4.5", sector: "Sector 2",
    date: "2026-08-18", user: "Ana Flores", votes: 31,
    imageUrl: "https://images.unsplash.com/photo-1623682864217-9fc26b5207e0?w=400&h=250&fit=crop&q=80",
    lat: -12.1958, lng: -76.9412,
  },
  {
    id: "R-2026-004", type: "escombros", severity: "medio", status: "resuelto",
    description: "Escombros de construcción depositados ilegalmente bloqueando parcialmente la vía pública y dificultando el tránsito peatonal.",
    location: "Jr. Las Magnolias Mz. 8", sector: "Sector 4",
    date: "2026-08-15", user: "Jorge Mamani", votes: 12,
    imageUrl: "https://images.unsplash.com/photo-1608653206809-e6a8044173b0?w=400&h=250&fit=crop&q=80",
    lat: -12.2108, lng: -76.9268,
  },
  {
    id: "R-2026-005", type: "aire", severity: "bajo", status: "resuelto",
    description: "Emisión de gases de fábrica informal supera los límites permitidos. Los residentes reportan irritación ocular y respiratoria.",
    location: "Zona Industrial VES - Mz. A Lt. 15", sector: "PPAO",
    date: "2026-08-12", user: "Rosa Condori", votes: 9,
    imageUrl: "https://images.unsplash.com/photo-1535479086554-4f8020786206?w=400&h=250&fit=crop&q=80",
    lat: -12.2068, lng: -76.9072,
  },
  {
    id: "R-2026-006", type: "basura", severity: "bajo", status: "resuelto",
    description: "Residuos domésticos arrojados en lote vacío. Incluye plásticos, cartones y restos de comida que atraen animales.",
    location: "Av. César Vallejo Mz. 22", sector: "Sector 7",
    date: "2026-08-10", user: "Luis Huanca", votes: 6,
    imageUrl: "https://images.unsplash.com/photo-1531326537431-6197cac3795b?w=400&h=250&fit=crop&q=80",
    lat: -12.2298, lng: -76.9458,
  },
  {
    id: "R-2026-007", type: "aguas", severity: "alto", status: "pendiente",
    description: "Canal de riego contaminado con residuos industriales. El agua presenta coloración oscura y olor químico fuerte.",
    location: "Canal Los Laureles - Sector 5", sector: "Sector 5",
    date: "2026-08-21", user: "Patricia Soto", votes: 28,
    imageUrl: "https://images.unsplash.com/photo-1586041828039-b8d193d6d1dc?w=400&h=250&fit=crop&q=80",
    lat: -12.2002, lng: -76.9188,
  },
  {
    id: "R-2026-008", type: "otros", severity: "medio", status: "pendiente",
    description: "Microempresa informal vierte aceite usado en alcantarilla. Se ha observado el hecho en repetidas ocasiones durante la semana.",
    location: "Jr. Los Ficus Mz. 31 Lt. 8", sector: "Sector 1",
    date: "2026-08-20", user: "Roberto Ccama", votes: 15,
    imageUrl: "https://images.unsplash.com/photo-1597535827808-73616636cc96?w=400&h=250&fit=crop&q=80",
    lat: -12.1912, lng: -76.9538,
  },
];

// Real environmental news about VES / Lima / Peru
// Noticias actualizadas — semana del 25 al 31 de agosto 2026
const NEWS_ITEMS: NewsItem[] = [
  {
    id: "N001",
    title: "SENAMHI: VES registra PM2.5 de 74 µg/m³, nivel 'Malo' por sexta semana consecutiva",
    source: "SENAMHI · senamhi.gob.pe",
    date: "2026-08-30",
    summary: "La estación Santa María de la Tablada supera tres veces el límite diario de 25 µg/m³ recomendado por la OMS. Los principales factores son vehículos diésel y quema informal nocturna de residuos.",
    imageUrl: "https://images.unsplash.com/photo-1535479086554-4f8020786206?w=400&h=250&fit=crop&q=80",
    url: "https://www.senamhi.gob.pe",
    tag: "Calidad del Aire",
    tagColor: "#818CF8",
  },
  {
    id: "N002",
    title: "OEFA inicia fiscalización de 14 empresas del PIVES tras denuncias de vertidos ilegales",
    source: "OEFA · oefa.gob.pe",
    date: "2026-08-28",
    summary: "El organismo fiscalizador inició operativos sorpresa en el Parque Industrial de VES ante la detección de efluentes industriales en las acequias del sector. Se esperan sanciones de hasta 600 UIT.",
    imageUrl: "https://images.unsplash.com/photo-1623682864217-9fc26b5207e0?w=400&h=250&fit=crop&q=80",
    url: "https://www.oefa.gob.pe",
    tag: "Industrial",
    tagColor: "#D32F2F",
  },
  {
    id: "N003",
    title: "MINAM lanza 'Perú Limpio 2026': nuevas metas de reducción de plásticos de un solo uso",
    source: "MINAM · minam.gob.pe",
    date: "2026-08-26",
    summary: "El Ministerio del Ambiente presentó el plan nacional para eliminar plásticos de un solo uso antes de 2028. VES es uno de los 12 distritos piloto con mayor apoyo técnico y financiero del programa.",
    imageUrl: "https://images.unsplash.com/photo-1604187351574-c75ca79f5807?w=400&h=250&fit=crop&q=80",
    url: "https://www.minam.gob.pe",
    tag: "Plásticos",
    tagColor: "#4ADE80",
  },
  {
    id: "N004",
    title: "Municipalidad VES amplía programa de segregación a 9 sectores adicionales",
    source: "Municipalidad VES · munives.gob.pe",
    date: "2026-08-25",
    summary: "La Gerencia de Servicios a la Ciudad informó que el programa 'Mi Barrio Sin Basura' llega a 9 nuevos sectores con 220 puntos de acopio diferenciado. Se distribuirán kits de reciclaje gratuitos.",
    imageUrl: "https://images.unsplash.com/photo-1662534264036-7bfa0d35de9c?w=400&h=250&fit=crop&q=80",
    url: "https://www.munives.gob.pe",
    tag: "Residuos",
    tagColor: "#FBBF24",
  },
  {
    id: "N005",
    title: "Andina: récord histórico de temperatura en Lima Sur — 29.1°C en agosto 2026",
    source: "Andina · andina.pe",
    date: "2026-08-23",
    summary: "La agencia estatal registró el lunes la temperatura más alta para un mes de agosto en 35 años de registro meteorológico en Lima Sur. El fenómeno agrava el smog y la evaporación de contaminantes acuáticos.",
    imageUrl: "https://images.unsplash.com/photo-1759255263592-a720f092de44?w=400&h=250&fit=crop&q=80",
    url: "https://andina.pe",
    tag: "Clima",
    tagColor: "#FBBF24",
  },
  {
    id: "N006",
    title: "SERPAR y vecinos de VES plantan 600 árboles nativos en el eje de la Av. El Sol",
    source: "SERPAR Lima · serpar.gob.pe",
    date: "2026-08-22",
    summary: "La jornada de arborización sumó más de 800 voluntarios y plantó molle serrano, ficus y tara a lo largo de 4 km. Cada árbol cuenta con un código QR para seguimiento ciudadano de su crecimiento.",
    imageUrl: "https://images.unsplash.com/photo-1715484955021-3432e88eba99?w=400&h=250&fit=crop&q=80",
    url: "https://www.serpar.gob.pe",
    tag: "Reforestación",
    tagColor: "#388E3C",
  },
];

const TRUSTED_SOURCES: TrustedSource[] = [
  { name: "MINAM", full: "Ministerio del Ambiente del Perú", url: "https://www.minam.gob.pe", desc: "Organismo rector de la política nacional ambiental. Publica normativas, informes de calidad ambiental y planes de gestión.", color: "#4ADE80", logo: "🌿" },
  { name: "SENAMHI", full: "Servicio Nacional de Meteorología e Hidrología", url: "https://www.senamhi.gob.pe", desc: "Datos oficiales de calidad del aire, temperatura, precipitación y pronósticos meteorológicos en tiempo real.", color: "#00D4FF", logo: "🌤" },
  { name: "OEFA", full: "Organismo de Evaluación y Fiscalización Ambiental", url: "https://www.oefa.gob.pe", desc: "Fiscaliza el cumplimiento de la normativa ambiental. Publica sanciones a empresas e informes de monitoreo.", color: "#D32F2F", logo: "🔍" },
  { name: "Municipalidad VES", full: "Municipalidad Distrital de Villa El Salvador", url: "https://www.munives.gob.pe", desc: "Gestión de residuos sólidos, áreas verdes, programas de reciclaje y ordenanzas ambientales del distrito.", color: "#1565C0", logo: "🏛" },
  { name: "Andina", full: "Agencia de Noticias del Estado Peruano", url: "https://andina.pe", desc: "Agencia oficial del Estado peruano. Cubre noticias ambientales, decretos ministeriales y programas gubernamentales.", color: "#818CF8", logo: "📰" },
  { name: "IMARPE", full: "Instituto del Mar del Perú", url: "https://www.imarpe.gob.pe", desc: "Investigación científica marina. Monitoreo de microplásticos, contaminación costera y ecosistemas marinos en Lima.", color: "#00838F", logo: "🌊" },
  { name: "La República", full: "Diario La República", url: "https://larepublica.pe", desc: "Diario de referencia nacional con cobertura especializada en medio ambiente, salud pública y Lima Metropolitana.", color: "#C62828", logo: "📋" },
  { name: "SERPAR Lima", full: "Servicio de Parques de Lima", url: "https://www.serpar.gob.pe", desc: "Administra parques, áreas verdes y programas de arborización en Lima. Coordina campañas de reforestación en VES.", color: "#388E3C", logo: "🌳" },
];

const ECO_ALERTS: EcoAlert[] = [
  {
    id: "A001", title: "Gran Jornada de Limpieza VES", type: "limpieza",
    date: "2026-09-06", time: "07:00 AM", location: "Parque Zonal Huáscar",
    description: "Únete a la limpieza comunal más grande del año en Villa El Salvador. Traer guantes y bolsas. La municipalidad provee equipos y refrigerio para todos los participantes.",
    participants: 143, maxParticipants: 200,
  },
  {
    id: "A002", title: "Taller de Reciclaje Creativo", type: "reciclaje",
    date: "2026-09-10", time: "10:00 AM", location: "Casa de la Juventud VES",
    description: "Aprende a transformar residuos en arte y objetos útiles. Especial para niños y jóvenes. Cupos muy limitados, ¡inscríbete ya!",
    participants: 67, maxParticipants: 80,
  },
  {
    id: "A003", title: "Recolección de Residuos Electrónicos", type: "residuos",
    date: "2026-09-14", time: "09:00 AM", location: "Plaza Mayor de VES",
    description: "Entrega tus equipos electrónicos en desuso: celulares, laptops, cables, pilas. Disposición responsable certificada por empresa autorizada.",
    participants: 89, maxParticipants: 500,
  },
  {
    id: "A004", title: "Plantación de 500 Árboles en VES", type: "arboles",
    date: "2026-09-20", time: "06:30 AM", location: "Av. El Sol - Tramo VES",
    description: "Campaña de arborización en coordinación con SERPAR Lima. Se plantarán ficus, molle y tara nativos. Cada participante adopta un árbol.",
    participants: 201, maxParticipants: 300,
  },
  {
    id: "A005", title: "Feria Ambiental VES 2026", type: "evento",
    date: "2026-09-27", time: "10:00 AM", location: "Parque Industrial VES",
    description: "Exposiciones, talleres, stands de ONG ambientales y actividades para toda la familia. Entrada libre. Premio al mejor proyecto ambiental escolar.",
    participants: 312, maxParticipants: 1000,
  },
];

const CITIZENS: CitizenUser[] = [
  { id: "U001", name: "Patricia Soto", points: 2840, level: "Eco Héroe", levelNum: 4, reports: 47, resolved: 38, sector: "Sector 5", badges: ["primer_reporte", "diez_reportes", "resolutor", "veterano"], avatar: "PS" },
  { id: "U002", name: "María García", points: 2340, level: "Eco Héroe", levelNum: 4, reports: 39, resolved: 31, sector: "Sector 3", badges: ["primer_reporte", "diez_reportes", "veterano"], avatar: "MG" },
  { id: "U003", name: "Carlos Quispe", points: 1890, level: "Eco Guardián", levelNum: 3, reports: 31, resolved: 22, sector: "Sector 6", badges: ["primer_reporte", "diez_reportes", "resolutor"], avatar: "CQ" },
  { id: "U004", name: "Ana Flores", points: 1540, level: "Eco Guardián", levelNum: 3, reports: 26, resolved: 18, sector: "Sector 2", badges: ["primer_reporte", "diez_reportes"], avatar: "AF" },
  { id: "U005", name: "Jorge Mamani", points: 980, level: "Eco Protector", levelNum: 2, reports: 16, resolved: 11, sector: "Sector 4", badges: ["primer_reporte", "activo"], avatar: "JM" },
  { id: "U006", name: "Rosa Condori", points: 760, level: "Eco Protector", levelNum: 2, reports: 12, resolved: 8, sector: "PPAO", badges: ["primer_reporte"], avatar: "RC" },
  { id: "U007", name: "Luis Huanca", points: 340, level: "Eco Novato", levelNum: 1, reports: 6, resolved: 3, sector: "Sector 7", badges: ["primer_reporte"], avatar: "LH" },
];

// Actualizado semana 25-31 ago 2026 — fuentes verificadas
const ARTICLES: Article[] = [
  {
    id: "ART001", title: "Lima entre las 10 ciudades con peor calidad de aire de Sudamérica en 2026", category: "contaminacion",
    source: "IQAir / SENAMHI", tags: ["aire", "pm2.5", "iqair", "lima", "salud"],
    summary: "El informe IQAir 2026 posiciona a Lima en el top 10 de ciudades con peor AQI de la región. Las estaciones de Lima Sur, incluyendo VES, registran PM2.5 entre 3 y 5 veces el límite de la OMS.",
    readTime: 7, date: "2026-08-28",
    imageUrl: "https://images.unsplash.com/photo-1535479086554-4f8020786206?w=800&h=400&fit=crop&q=80",
    views: 5810,
  },
  {
    id: "ART002", title: "Guía 2026: cómo segregar residuos según el nuevo código de colores del MINAM", category: "residuos",
    source: "MINAM", tags: ["segregación", "reciclaje", "basura", "colores", "minam"],
    summary: "El MINAM actualizó el código: verde (orgánicos), azul (papel/cartón), amarillo (plásticos/metal), negro (no reciclable), rojo (peligrosos), marrón (RAEE). Aprende qué va en cada bolsa con ejemplos prácticos.",
    readTime: 5, date: "2026-08-26",
    imageUrl: "https://images.unsplash.com/photo-1611284446314-60a58ac0deb9?w=800&h=400&fit=crop&q=80",
    views: 3450,
  },
  {
    id: "ART003", title: "Ahorro de agua en Lima Sur: 10 hábitos para el verano 2026-2027", category: "agua",
    source: "SEDAPAL / MINAM", tags: ["agua", "sedapal", "déficit hídrico", "verano", "ves"],
    summary: "SEDAPAL proyecta déficit de suministro en VES para el verano próximo. Con temperaturas récord, el consumo hídrico sube 40%. Descubre cómo reducir tu consumo hasta un 30% con cambios simples en tu rutina.",
    readTime: 6, date: "2026-08-25",
    imageUrl: "https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800&h=400&fit=crop&q=80",
    views: 3780,
  },
  {
    id: "ART004", title: "PIVES: empresas más contaminantes bajo la lupa de OEFA en 2026", category: "contaminacion",
    source: "OEFA", tags: ["parque industrial", "oefa", "sanción", "empresas", "vertidos"],
    summary: "Especial investigativo: las 12 empresas del Parque Industrial de VES con mayor número de infracciones ambientales en 2025-2026, sus sanciones y el estado de sus planes de adecuación ambiental.",
    readTime: 10, date: "2026-08-22",
    imageUrl: "https://images.unsplash.com/photo-1535479672101-8486af672be0?w=800&h=400&fit=crop&q=80",
    views: 6120,
  },
  {
    id: "ART005", title: "Microplásticos en playas del sur de Lima: estudio IMARPE 2026", category: "agua",
    source: "IMARPE", tags: ["microplásticos", "playa", "mar", "lurín", "imarpe"],
    summary: "Estudio del IMARPE detecta microplásticos en el 95% de las muestras de agua de las playas de Lurín, Villa María y Punta Hermosa. Cómo reducir tu huella plástica desde Villa El Salvador.",
    readTime: 8, date: "2026-08-20",
    imageUrl: "https://images.unsplash.com/photo-1531326537431-6197cac3795b?w=800&h=400&fit=crop&q=80",
    views: 4340,
  },
  {
    id: "ART006", title: "Compostaje comunitario en VES: el Sector 5 redujo 60% sus residuos orgánicos", category: "reciclaje",
    source: "Municipalidad VES", tags: ["compostaje", "sector 5", "orgánicos", "reciclaje", "vecinos"],
    summary: "El programa piloto de compostaje comunitario del Sector 5 lleva 8 meses en marcha. Entrevistamos a los vecinos líderes y aprendemos cómo replicar la iniciativa en tu manzana con costo cero.",
    readTime: 7, date: "2026-08-18",
    imageUrl: "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=800&h=400&fit=crop&q=80",
    views: 2340,
  },
  {
    id: "ART007", title: "Récord de temperatura en VES en agosto 2026: 29.1°C — qué significa para el medio ambiente", category: "clima",
    source: "SENAMHI / Andina", tags: ["temperatura", "calor", "isla de calor", "senamhi", "ves"],
    summary: "SENAMHI registró 29.1°C en Villa El Salvador el 25 de agosto, el valor más alto para ese mes en 35 años. Analizamos por qué el sur de Lima es cada vez más vulnerable al calor urbano y qué hacer.",
    readTime: 9, date: "2026-08-26",
    imageUrl: "https://images.unsplash.com/photo-1759255263592-a720f092de44?w=800&h=400&fit=crop&q=80",
    views: 5290,
  },
  {
    id: "ART008", title: "Directorio 2026: dónde entregar tus residuos electrónicos (RAEE) en Villa El Salvador", category: "reciclaje",
    source: "MINAM / Municipalidad VES", tags: ["raee", "electrónicos", "pilas", "reciclaje", "directorio"],
    summary: "Celulares, laptops, pilas, cargadores… los residuos de aparatos eléctricos y electrónicos contienen metales pesados altamente tóxicos. Directorio completo de puntos de acopio certificados en VES.",
    readTime: 4, date: "2026-08-15",
    imageUrl: "https://images.unsplash.com/photo-1604187351574-c75ca79f5807?w=800&h=400&fit=crop&q=80",
    views: 2190,
  },
];

const MONTHLY_DATA = [
  { mes: "Feb", reportes: 31, resueltos: 25 },
  { mes: "Mar", reportes: 28, resueltos: 22 },
  { mes: "Abr", reportes: 45, resueltos: 38 },
  { mes: "May", reportes: 52, resueltos: 41 },
  { mes: "Jun", reportes: 67, resueltos: 53 },
  { mes: "Jul", reportes: 71, resueltos: 58 },
  { mes: "Ago", reportes: 49, resueltos: 38 },
];

const TYPE_DIST = [
  { name: "Basura", value: 38, color: "#EF5350" },
  { name: "Aguas", value: 22, color: "#42A5F5" },
  { name: "Quema", value: 18, color: "#FFA726" },
  { name: "Escombros", value: 12, color: "#78909C" },
  { name: "Aire", value: 7, color: "#AB47BC" },
  { name: "Otros", value: 3, color: "#66BB6A" },
];

const SECTOR_DATA = [
  { sector: "Sector 1", reportes: 12 },
  { sector: "Sector 2", reportes: 28 },
  { sector: "Sector 3", reportes: 35 },
  { sector: "Sector 4", reportes: 19 },
  { sector: "Sector 5", reportes: 41 },
  { sector: "Sector 6", reportes: 23 },
  { sector: "Sector 7", reportes: 15 },
  { sector: "PPAO", reportes: 31 },
];

// ==================== CONFIG MAPS ====================

const TYPE_CONFIG: Record<ReportType, { label: string; icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>; color: string; bg: string }> = {
  basura:    { label: "Basura acumulada",        icon: Trash2,       color: "#EF5350", bg: "#FFEBEE" },
  quema:     { label: "Quema de residuos",       icon: Flame,        color: "#FF7043", bg: "#FBE9E7" },
  aguas:     { label: "Aguas contaminadas",      icon: Droplets,     color: "#42A5F5", bg: "#E3F2FD" },
  escombros: { label: "Escombros",               icon: Package,      color: "#78909C", bg: "#ECEFF1" },
  aire:      { label: "Contaminación del aire",  icon: Wind,         color: "#AB47BC", bg: "#F3E5F5" },
  otros:     { label: "Otros",                   icon: AlertCircle,  color: "#66BB6A", bg: "rgba(74,222,128,0.12)" },
};

const SEVERITY_CONFIG: Record<Severity, { label: string; color: string; bg: string; dot: string }> = {
  bajo:  { label: "Bajo",  color: "#388E3C", bg: "rgba(74,222,128,0.12)", dot: "#4CAF50" },
  medio: { label: "Medio", color: "#FBBF24", bg: "#FFF3E0", dot: "#FF9800" },
  alto:  { label: "Alto",  color: "#D32F2F", bg: "#FFEBEE", dot: "#F44336" },
};

const STATUS_CONFIG: Record<ReportStatus, { label: string; color: string; bg: string; icon: React.ComponentType<{ className?: string }> }> = {
  pendiente: { label: "Pendiente",  color: "#D32F2F", bg: "#FFEBEE", icon: AlertCircle },
  proceso:   { label: "En proceso", color: "#FBBF24", bg: "#FFF3E0", icon: Clock },
  resuelto:  { label: "Resuelto",   color: "#388E3C", bg: "rgba(74,222,128,0.12)", icon: CheckCircle },
};

const ALERT_CONFIG: Record<string, { icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>; color: string; bg: string }> = {
  limpieza: { icon: Trash2,    color: "#00D4FF", bg: "#E1F5FE" },
  reciclaje: { icon: Recycle,  color: "#388E3C", bg: "rgba(74,222,128,0.12)" },
  residuos:  { icon: Package,  color: "#818CF8", bg: "#F3E5F5" },
  arboles:   { icon: Leaf,     color: "#4ADE80", bg: "rgba(74,222,128,0.12)" },
  evento:    { icon: Star,     color: "#FBBF24", bg: "#FFF3E0" },
};

const CAT_CONFIG: Record<string, { label: string; color: string }> = {
  reciclaje:     { label: "Reciclaje",      color: "#388E3C" },
  residuos:      { label: "Residuos",       color: "#78909C" },
  agua:          { label: "Agua",           color: "#00D4FF" },
  contaminacion: { label: "Contaminación",  color: "#818CF8" },
  clima:         { label: "Clima",          color: "#FBBF24" },
};

const BADGE_CONFIG: Record<string, { label: string; desc: string; icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>; color: string }> = {
  primer_reporte: { label: "Primer Reporte",    desc: "Registraste tu primer incidente ambiental",   icon: Star,         color: "#FFC107" },
  diez_reportes:  { label: "10 Reportes",        desc: "Alcanzaste 10 reportes verificados",            icon: Target,       color: "#2196F3" },
  resolutor:      { label: "Resolutor",          desc: "Tus reportes tienen alta tasa de resolución",  icon: CheckCircle,  color: "#4CAF50" },
  veterano:       { label: "Veterano VES",       desc: "Más de 6 meses activo en la plataforma",       icon: Shield,       color: "#9C27B0" },
  activo:         { label: "Ciudadano Activo",   desc: "Realizaste 3 o más reportes",                  icon: Zap,          color: "#FF9800" },
};

const LEVEL_CONFIG: Record<string, { color: string; bg: string; nextPoints: number }> = {
  "Eco Novato":    { color: "#78909C", bg: "#ECEFF1", nextPoints: 500  },
  "Eco Protector": { color: "#00D4FF", bg: "#E1F5FE", nextPoints: 1500 },
  "Eco Guardián":  { color: "#388E3C", bg: "rgba(74,222,128,0.12)", nextPoints: 2500 },
  "Eco Héroe":     { color: "#FBBF24", bg: "#FFF3E0", nextPoints: 9999 },
};

const NEXT_LEVEL: Record<string, string> = {
  "Eco Novato": "Eco Protector", "Eco Protector": "Eco Guardián", "Eco Guardián": "Eco Héroe", "Eco Héroe": "Máximo",
};

// ==================== SHARED UI ====================

function SeverityBadge({ severity }: { severity: Severity }) {
  const c = SEVERITY_CONFIG[severity];
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold" style={{ color: c.color, backgroundColor: c.bg }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: c.dot }} />
      {c.label}
    </span>
  );
}

function StatusBadge({ status }: { status: ReportStatus }) {
  const c = STATUS_CONFIG[status];
  const Icon = c.icon;
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold" style={{ color: c.color, backgroundColor: c.bg }}>
      <Icon className="w-3 h-3" />
      {c.label}
    </span>
  );
}

function TypeBadge({ type }: { type: ReportType }) {
  const c = TYPE_CONFIG[type];
  const Icon = c.icon;
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold" style={{ color: c.color, backgroundColor: c.bg }}>
      <Icon className="w-3 h-3" />
      {c.label}
    </span>
  );
}

function StatCard({ value, label, icon: Icon, color }: { value: string; label: string; icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>; color: string }) {
  return (
    <motion.div
      whileHover={{ y: -3, boxShadow: "0 8px 24px rgba(0,0,0,0.10)" }}
      transition={{ duration: 0.2 }}
      className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center gap-3"
    >
      <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: color + "18" }}>
        <Icon className="w-5 h-5" style={{ color }} />
      </div>
      <div>
        <div className="text-xl font-bold text-gray-900 leading-tight">{value}</div>
        <div className="text-xs text-gray-500 leading-tight">{label}</div>
      </div>
    </motion.div>
  );
}

function ReportCard({ report, onClick }: { report: Report; onClick?: () => void }) {
  return (
    <motion.div
      whileHover={{ y: -2, boxShadow: "0 8px 24px rgba(0,0,0,0.09)" }}
      transition={{ duration: 0.2 }}
      onClick={onClick}
      className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 cursor-pointer"
    >
      <div className="relative">
        <img
          src={report.imageUrl}
          alt={report.type}
          className="w-full h-40 object-cover bg-gray-100"
          onError={e => { (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1662534264036-7bfa0d35de9c?w=400&h=250&fit=crop&q=80"; }}
        />
        <div className="absolute top-2.5 left-2.5"><SeverityBadge severity={report.severity} /></div>
        <div className="absolute top-2.5 right-2.5"><StatusBadge status={report.status} /></div>
      </div>
      <div className="p-4">
        <div className="flex items-center justify-between gap-2 mb-2">
          <TypeBadge type={report.type} />
          <span className="text-xs text-gray-400">{report.date}</span>
        </div>
        <p className="text-sm text-gray-700 line-clamp-2 mb-3">{report.description}</p>
        <div className="flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center gap-1"><MapPin className="w-3 h-3" />{report.sector}</div>
          <div className="flex items-center gap-1"><Star className="w-3 h-3" />{report.votes} apoyos</div>
        </div>
      </div>
    </motion.div>
  );
}

function ReportModal({ report, onClose }: { report: Report; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl w-full max-w-md overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <img
          src={report.imageUrl}
          alt=""
          className="w-full h-44 object-cover bg-gray-100"
          onError={e => { (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1662534264036-7bfa0d35de9c?w=400&h=250&fit=crop&q=80"; }}
        />
        <div className="p-5">
          <div className="flex flex-wrap gap-2 mb-3">
            <TypeBadge type={report.type} />
            <SeverityBadge severity={report.severity} />
            <StatusBadge status={report.status} />
          </div>
          <p className="text-sm text-gray-700 mb-3">{report.description}</p>
          <div className="space-y-1 text-xs text-gray-500 mb-4">
            <div className="flex items-center gap-1.5"><MapPin className="w-3 h-3" />{report.location} · {report.sector}</div>
            <div className="flex items-center gap-1.5"><Users className="w-3 h-3" />Reportado por {report.user} · {report.date}</div>
            <div className="flex items-center gap-1.5"><Star className="w-3 h-3" />{report.votes} vecinos apoyaron este reporte</div>
          </div>
          <button onClick={onClose} className="w-full bg-gray-100 text-gray-600 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-200 transition-colors">
            Cerrar
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ==================== HOME PAGE ====================

function HeroSlideshow({ setPage }: { setPage: (p: Page) => void }) {
  return (
    <section className="relative overflow-hidden bg-[#0B0F14] text-white px-4 sm:px-6 lg:px-8 pt-12 pb-16 sm:pt-16 sm:pb-20">
      <div className="pointer-events-none absolute -top-20 -right-16 h-96 w-96 rounded-full bg-[#4ADE80]/[0.08] blur-[100px]" />
      <div className="pointer-events-none absolute -bottom-32 left-0 h-80 w-80 rounded-full bg-[#00D4FF]/[0.06] blur-[100px]" />
      <div className="relative z-10 mx-auto grid max-w-7xl grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-16">
        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }} className="space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#4ADE80]/20 bg-[#4ADE80]/10 px-4 py-2 text-xs sm:text-sm font-medium text-[#4ADE80]">
            <Sparkles className="h-4 w-4" /> Plataforma de Inteligencia Ambiental
          </div>
          <h1 className="text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl xl:text-7xl">
            Protege tu <span className="bg-gradient-to-r from-[#4ADE80] via-[#22D3EE] to-[#00D4FF] bg-clip-text text-transparent">comunidad</span><br />con tecnología
          </h1>
          <p className="max-w-lg text-base leading-relaxed text-gray-400 sm:text-lg">
            EcoAlert VES une <strong className="font-medium text-gray-200">tecnología</strong> y <strong className="font-medium text-gray-200">participación ciudadana</strong> para hacer visibles los problemas ambientales de Villa El Salvador. Tu barrio, tu voz, tu próximo paso.
          </p>
          <div className="flex flex-col gap-3 pt-1 sm:flex-row">
            <motion.button whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }} onClick={() => setPage("report")} className="flex h-12 items-center justify-center gap-2 rounded-xl bg-[#4ADE80] px-7 text-sm font-semibold text-[#0B0F14] shadow-lg shadow-[#4ADE80]/20 transition hover:bg-[#3AC76F]">
              <Zap className="h-4 w-4" /> Reportar ahora
            </motion.button>
            <motion.button whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }} onClick={() => setPage("map")} className="flex h-12 items-center justify-center gap-2 rounded-xl border border-white/[0.12] px-7 text-sm font-semibold text-gray-300 transition hover:border-white/[0.2] hover:bg-white/[0.04]">
              <MapPin className="h-4 w-4 text-[#00D4FF]" /> Ver mapa en vivo
            </motion.button>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-2 pt-1 text-xs text-gray-500">
            <span className="flex items-center gap-1.5"><Shield className="h-3.5 w-3.5 text-[#4ADE80]" /> Participación ciudadana</span>
            <span className="flex items-center gap-1.5"><Globe className="h-3.5 w-3.5 text-[#00D4FF]" /> 100% gratuito</span>
            <span className="flex items-center gap-1.5"><Heart className="h-3.5 w-3.5 text-pink-400" /> Comunidad activa</span>
          </div>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.65, delay: 0.1 }} className="relative mx-auto flex w-full max-w-[390px] items-center justify-center eco-phone">
          <div className="absolute -left-10 top-16 z-20 rounded-xl border border-[#4ADE80]/25 bg-[#1a1f2e] px-3 py-2.5 shadow-xl shadow-black/30">
            <p className="text-[10px] font-semibold text-white">Tu barrio, en el mapa</p><p className="text-[9px] text-gray-500">Villa El Salvador</p>
          </div>
          <div className="absolute -right-8 bottom-16 z-20 rounded-xl border border-[#FBBF24]/25 bg-[#1a1f2e] px-3 py-2.5 shadow-xl shadow-black/30">
            <p className="text-[10px] font-semibold text-white">+50 EcoPuntos</p><p className="text-[9px] text-gray-500">¡Sigue así!</p>
          </div>
          <div className="w-[260px] rounded-[2.5rem] bg-gradient-to-b from-[#2a2f3a] to-[#1a1f2e] p-[3px] shadow-2xl shadow-black/50">
            <div className="overflow-hidden rounded-[2.3rem] bg-gradient-to-b from-[#1a1f2e] to-[#0B0F14] px-4 pb-6">
              <div className="mx-auto mt-2 h-5 w-24 rounded-full bg-black" />
              <div className="my-4 text-center"><div className="mb-1 inline-flex items-center gap-1.5"><span className="flex h-5 w-5 items-center justify-center rounded-md bg-gradient-to-br from-[#4ADE80] to-[#00D4FF]"><Leaf className="h-3 w-3 text-[#0B0F14]" /></span><span className="text-xs font-bold text-[#4ADE80]">EcoAlert VES</span></div><p className="text-[9px] text-gray-500">¿Qué deseas reportar?</p></div>
              <div className="relative mb-3 flex h-28 items-center justify-center overflow-hidden rounded-xl border border-white/[0.06] bg-gradient-to-br from-[#0d2818] via-[#0a1628] to-[#0B0F14]">
                <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "linear-gradient(rgba(74,222,128,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(74,222,128,0.3) 1px, transparent 1px)", backgroundSize: "20px 20px" }} />
                <MapPin className="relative z-10 h-7 w-7 fill-[#4ADE80]/30 text-[#4ADE80] drop-shadow-lg" />
                <MapPin className="absolute left-6 top-4 h-3 w-3 text-[#00D4FF]/70" /><MapPin className="absolute right-7 top-7 h-3 w-3 text-[#FBBF24]/70" /><MapPin className="absolute bottom-5 left-10 h-3 w-3 text-red-400/70" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[ ["🗑️", "Basura", "#4ADE80"], ["🔥", "Quema", "#EF4444"], ["💧", "Agua", "#00D4FF"], ["📍", "Otro", "#FBBF24"] ].map(([emoji, label, color]) => <div key={label} className="flex flex-col items-center gap-1.5 rounded-xl border p-3" style={{ backgroundColor: `${color}10`, borderColor: `${color}25` }}><span className="text-lg">{emoji}</span><span className="text-[9px] font-medium text-gray-300">{label}</span></div>)}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function HomePage({ setPage, liveReports = [] }: { setPage: (p: Page) => void; liveReports?: SubmittedReport[] }) {
  const pendingCount = liveReports.filter(r => r.status !== "resuelto").length;
  const resolvedCount = liveReports.filter(r => r.status === "resuelto").length;
  const totalReports = liveReports.length;
  const totalResolved = resolvedCount;

  return (
    <div className="min-h-screen bg-background">
      <HeroSlideshow setPage={setPage} />

      {/* Stats */}
      <section className="max-w-7xl mx-auto px-4 -mt-8 mb-8 relative z-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { value: String(totalReports), label: "Reportes realizados", icon: FileCheck as React.ComponentType<any>, color: "#4ADE80" },
            { value: String(totalResolved), label: "Casos resueltos", icon: CheckCircle as React.ComponentType<any>, color: "#00D4FF" },
            { value: String(pendingCount), label: "Reportes por atender", icon: Users as React.ComponentType<any>, color: "#818CF8" },
            { value: "6", label: "Tipos de incidencia", icon: Clock as React.ComponentType<any>, color: "#FBBF24" },
          ].map(s => (
            <StatCard key={s.label} value={s.value} label={s.label} icon={s.icon} color={s.color} />
          ))}
        </div>
      </section>

      <HowItWorks navigate={setPage} />

      {/* Live recent reports strip */}
      {liveReports.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <h2 className="text-sm font-bold text-gray-700">Reportes recientes de la comunidad</h2>
            <button onClick={() => setPage("community")} className="ml-auto text-xs font-semibold" style={{ color: "#00D4FF" }}>Ver todos →</button>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
            {liveReports.slice(0, 8).map(r => {
              const tc = TYPE_CONFIG[r.type] || TYPE_CONFIG["otros"];
              return (
                <div key={r.id} onClick={() => setPage("community")} className="flex-shrink-0 w-52 bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100 cursor-pointer hover:shadow-md transition-shadow">
                  {r.imageUrl ? <img src={r.imageUrl} alt="" className="w-full h-28 object-cover bg-gray-100" onError={e => { (e.target as HTMLImageElement).style.display="none"; }} /> : <div className="w-full h-28 flex items-center justify-center text-3xl" style={{ backgroundColor: tc.bg }}>📷</div>}
                  <div className="p-2.5">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: tc.bg, color: tc.color }}>{tc.label}</span>
                    <p className="text-xs text-gray-600 mt-1 line-clamp-2 leading-snug">{r.description}</p>
                    <p className="text-[10px] text-gray-400 mt-1">{r.userName} · {r.time}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* News section — replaces "Últimos Reportes" */}
      <section className="max-w-7xl mx-auto px-4 mb-10">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Noticias ambientales · ejemplos</h2>
            <p className="text-sm text-gray-500">Contenido de demostración; consulta los portales oficiales para noticias actuales.</p>
          </div>
          <button onClick={() => setPage("map")} className="flex items-center gap-1 text-sm font-semibold hover:underline" style={{ color: "#00D4FF" }}>
            Ver mapa <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {NEWS_ITEMS.slice(0, 6).map((news, idx) => (
            <motion.a
              key={news.id}
              href={news.url}
              target="_blank"
              rel="noopener noreferrer"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.06 }}
              whileHover={{ y: -2, boxShadow: "0 8px 24px rgba(0,0,0,0.09)" }}
              className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 cursor-pointer block"
            >
              <div className="relative">
                <img
                  src={news.imageUrl}
                  alt={news.title}
                  className="w-full h-40 object-cover bg-gray-100"
                  onError={e => { (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1535479086554-4f8020786206?w=400&h=250&fit=crop&q=80"; }}
                />
                <div className="absolute top-2.5 left-2.5">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold text-white shadow-sm" style={{ backgroundColor: news.tagColor }}>
                    {news.tag}
                  </span>
                </div>
              </div>
              <div className="p-4">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-xs font-medium text-gray-400 truncate">{news.source}</span>
                  <span className="text-xs text-gray-400 flex-shrink-0">{news.date}</span>
                </div>
                <h3 className="text-sm font-semibold text-gray-900 line-clamp-2 mb-2 leading-snug">{news.title}</h3>
                <p className="text-xs text-gray-500 line-clamp-2">{news.summary}</p>
                <div className="flex items-center gap-1 mt-3 text-xs font-semibold" style={{ color: "#00D4FF" }}>
                  <ExternalLink className="w-3 h-3" /> Visitar portal de la fuente
                </div>
              </div>
            </motion.a>
          ))}
        </div>
      </section>

      {/* Eco Alerts preview */}
      <section className="max-w-7xl mx-auto px-4 mb-16">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Actividades de la comunidad</h2>
            <p className="text-sm text-gray-500">Actividades de ejemplo para explorar la plataforma</p>
          </div>
          <button onClick={() => setPage("alerts")} className="flex items-center gap-1 text-sm font-semibold hover:underline" style={{ color: "#00D4FF" }}>
            Ver todas <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {ECO_ALERTS.slice(0, 4).map(alert => {
            const cfg = ALERT_CONFIG[alert.type];
            const Icon = cfg.icon;
            const pct = (alert.participants / alert.maxParticipants) * 100;
            return (
              <motion.div
                key={alert.id}
                whileHover={{ y: -2 }}
                transition={{ duration: 0.2 }}
                className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex gap-4"
              >
                <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: cfg.bg }}>
                  <Icon className="w-5 h-5" style={{ color: cfg.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 text-sm mb-1 leading-snug">{alert.title}</h3>
                  <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-1">
                    <Calendar className="w-3 h-3" />{alert.date} · {alert.time}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-gray-400 mb-2">
                    <MapPin className="w-3 h-3" /><span className="truncate">{alert.location}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                    <span>{alert.participants} participantes</span>
                    <span>{alert.maxParticipants} cupos</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5">
                    <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, backgroundColor: cfg.color }} />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </section>
      <MissionFooter navigate={setPage} />
    </div>
  );
}

// ==================== REPORT PAGE ====================

type GeoStatus = "idle" | "locating" | "found" | "denied" | "unavailable";

interface GeoState {
  status: GeoStatus;
  lat: number | null;
  lng: number | null;
  accuracy: number | null;
  address: string | null;
  timestamp: number | null;
}

function ReportPage({ setPage, setAnalysisData, user }: { setPage: (p: Page) => void; setAnalysisData: (d: any) => void; user: GoogleUser | null }) {
  const [selectedType, setSelectedType] = useState<ReportType | null>(null);
  const [description, setDescription] = useState("");
  const [locationMode, setLocationMode] = useState<"gps" | "manual">("gps");
  const [manualAddress, setManualAddress] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFileName, setImageFileName] = useState<string | null>(null);
  const [cameraMode, setCameraMode] = useState<"idle" | "live">("idle");
  const [cameraFacing, setCameraFacing] = useState<"environment" | "user">("environment");
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [geo, setGeo] = useState<GeoState>({ status: "idle", lat: null, lng: null, accuracy: null, address: null, timestamp: null });

  const [manualGeo, setManualGeo] = useState<{ lat: number | null; lng: number | null; loading: boolean; found: boolean }>({ lat: null, lng: null, loading: false, found: false });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const geocodeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const manualGeoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const manualMapContainerRef = useRef<HTMLDivElement>(null);
  const manualLeafletRef = useRef<any>(null);

  const reportTypes: ReportType[] = ["basura", "quema", "aguas", "escombros", "aire", "otros"];

  const reverseGeocode = useCallback(async (lat: number, lng: number) => {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=es`, { headers: { "Accept-Language": "es" } });
      const data = await res.json();
      const a = data.address ?? {};
      const parts = [a.road ?? a.pedestrian ?? a.footway, a.suburb ?? a.neighbourhood ?? a.quarter, a.city ?? a.town ?? a.village ?? a.municipality].filter(Boolean);
      setGeo(prev => ({ ...prev, address: parts.join(", ") || data.display_name }));
    } catch {}
  }, []);

  const startWatchingPosition = useCallback(() => {
    if (!navigator.geolocation) { setGeo(prev => ({ ...prev, status: "unavailable" })); return; }
    setGeo({ status: "locating", lat: null, lng: null, accuracy: null, address: null, timestamp: null });
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude: lat, longitude: lng, accuracy } = pos.coords;
        setGeo(prev => ({ ...prev, status: "found", lat, lng, accuracy, timestamp: pos.timestamp }));
        if (geocodeTimerRef.current) clearTimeout(geocodeTimerRef.current);
        geocodeTimerRef.current = setTimeout(() => reverseGeocode(lat, lng), 1200);
      },
      (err) => setGeo(prev => ({ ...prev, status: err.code === err.PERMISSION_DENIED ? "denied" : "unavailable" })),
      { enableHighAccuracy: true, maximumAge: 4000, timeout: 15000 }
    );
  }, [reverseGeocode]);

  const stopWatchingPosition = useCallback(() => {
    if (watchIdRef.current !== null) { navigator.geolocation.clearWatch(watchIdRef.current); watchIdRef.current = null; }
    if (geocodeTimerRef.current) clearTimeout(geocodeTimerRef.current);
  }, []);

  useEffect(() => {
    if (locationMode === "gps") startWatchingPosition();
    else { stopWatchingPosition(); setGeo({ status: "idle", lat: null, lng: null, accuracy: null, address: null, timestamp: null }); }
    return stopWatchingPosition;
  }, [locationMode, startWatchingPosition, stopWatchingPosition]);

  const startCamera = useCallback(async (facing: "environment" | "user") => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    setCameraReady(false); setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
        videoRef.current.onloadedmetadata = () => setCameraReady(true);
        setTimeout(() => setCameraReady(true), 1500);
      }
    } catch (err: any) {
      const msg = err?.name === "NotAllowedError" ? "Permiso de cámara denegado." : err?.name === "NotFoundError" ? "No se encontró ninguna cámara." : "No se pudo acceder a la cámara.";
      setCameraError(msg);
    }
  }, []);

  const stopCamera = useCallback(() => { streamRef.current?.getTracks().forEach(t => t.stop()); streamRef.current = null; setCameraReady(false); setCameraError(null); }, []);

  useEffect(() => { if (cameraMode === "live") startCamera(cameraFacing); else stopCamera(); return stopCamera; }, [cameraMode, cameraFacing, startCamera, stopCamera]);
  useEffect(() => () => { stopCamera(); stopWatchingPosition(); }, [stopCamera, stopWatchingPosition]);

  // Debounced forward geocode for manual address
  useEffect(() => {
    if (locationMode !== "manual") return;
    if (manualGeoTimerRef.current) clearTimeout(manualGeoTimerRef.current);
    if (manualAddress.length < 6) { setManualGeo({ lat: null, lng: null, loading: false, found: false }); return; }
    setManualGeo(g => ({ ...g, loading: true }));
    manualGeoTimerRef.current = setTimeout(async () => {
      const headers = { "Accept-Language": "es", "User-Agent": "EcoAlertVES/1.0" };
      const nearVES = (a: any) => {
        const distA = Math.abs(parseFloat(a.lat) + 12.213) + Math.abs(parseFloat(a.lon) + 76.924);
        return distA;
      };
      const tryGeocode = async (q: string, viewbox: string, bounded: boolean) => {
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=5&countrycodes=pe${bounded ? `&bounded=1&viewbox=${viewbox}` : `&viewbox=${viewbox}`}`;
        const res = await fetch(url, { headers });
        const data = await res.json();
        if (!data.length) return null;
        const sorted = [...data].sort((a: any, b: any) => nearVES(a) - nearVES(b));
        return sorted[0];
      };
      try {
        // 1st: tight VES box, bounded
        let result = await tryGeocode(`${manualAddress}, Villa El Salvador, Lima`, "-77.05,-12.30,-76.80,-12.05", true);
        // 2nd: wider Lima box, not bounded (finds more streets)
        if (!result) result = await tryGeocode(`${manualAddress}, Lima, Peru`, "-77.20,-12.50,-76.60,-11.80", false);
        if (result) {
          const lat = parseFloat(result.lat);
          const lng = parseFloat(result.lon);
          setManualGeo({ lat, lng, loading: false, found: true });
        } else {
          setManualGeo({ lat: null, lng: null, loading: false, found: false });
        }
      } catch { setManualGeo(g => ({ ...g, loading: false })); }
    }, 900);
    return () => { if (manualGeoTimerRef.current) clearTimeout(manualGeoTimerRef.current); };
  }, [manualAddress, locationMode]);

  // Render mini Leaflet map for manual geocode result
  useEffect(() => {
    if (!manualMapContainerRef.current || !manualGeo.found || manualGeo.lat === null || manualGeo.lng === null) return;
    const container = manualMapContainerRef.current;
    if (manualLeafletRef.current) {
      manualLeafletRef.current.setView([manualGeo.lat, manualGeo.lng], 16);
      if ((manualLeafletRef.current as any)._manualMarker) {
        (manualLeafletRef.current as any)._manualMarker.setLatLng([manualGeo.lat, manualGeo.lng]);
      }
      return;
    }
    const map = L.map(container, { zoomControl: false, attributionControl: false, dragging: false, scrollWheelZoom: false });
    L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", { maxZoom: 19 }).addTo(map);
    map.setView([manualGeo.lat, manualGeo.lng], 16);
    const marker = L.circleMarker([manualGeo.lat, manualGeo.lng], { radius: 10, color: "#4ADE80", fillColor: "#4CAF50", fillOpacity: 0.85, weight: 3 }).addTo(map);
    (map as any)._manualMarker = marker;
    manualLeafletRef.current = map;
    return () => { map.remove(); manualLeafletRef.current = null; };
  }, [manualGeo.found, manualGeo.lat, manualGeo.lng]);

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current; const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 1280; canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    if (cameraFacing === "user") { ctx.translate(canvas.width, 0); ctx.scale(-1, 1); }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    setImagePreview(canvas.toDataURL("image/jpeg", 0.93));
    setImageFileName("foto_camara.jpg");
    setCameraMode("idle");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setImageFileName(file.name);
    const reader = new FileReader();
    reader.onload = ev => { if (ev.target?.result) setImagePreview(ev.target.result as string); };
    reader.readAsDataURL(file); e.target.value = "";
  };

  const handleSubmit = async () => {
    if (!selectedType || !description) return;
    setSubmitting(true);
    const isManual = locationMode === "manual";
    const locCoords = isManual
      ? (manualGeo.found && manualGeo.lat !== null ? { lat: manualGeo.lat, lng: manualGeo.lng } : null)
      : (geo.status === "found" ? { lat: geo.lat, lng: geo.lng } : null);
    const locText = isManual
      ? (manualAddress || "Villa El Salvador, Lima")
      : (geo.address || (geo.status === "found" ? `${Math.abs(geo.lat!).toFixed(5)}°S, ${Math.abs(geo.lng!).toFixed(5)}°W` : "Villa El Salvador, Lima"));
    setAnalysisData({
      type: selectedType, description, imagePreview,
      location: locCoords,
      locationText: locText,
      userName: user?.name || "Anónimo",
      userPhoto: user?.photoUrl || null,
    });
    setSubmitting(false);
    setPage("analysis");
  };

  const formatCoords = (lat: number, lng: number) => `${Math.abs(lat).toFixed(6)}°${lat < 0 ? "S" : "N"}, ${Math.abs(lng).toFixed(6)}°${lng < 0 ? "W" : "E"}`;
  const formatAccuracy = (m: number) => m < 10 ? `±${m.toFixed(1)} m` : `±${Math.round(m)} m`;
  const accuracyColor = (m: number) => m <= 15 ? "#4CAF50" : m <= 50 ? "#FF9800" : "#F44336";

  return (
    <div className="min-h-screen bg-background pb-8">
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
      <canvas ref={canvasRef} className="hidden" />

      <div className="text-white px-4 py-6" style={{ background: "#4ADE80" }}>
        <h1 className="text-2xl font-bold">Reportar contaminación</h1>
        <p className="text-white/70 text-sm">Documenta y envía problemas ambientales en tu zona</p>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        {/* Photo card */}
        <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100">
          <div className="px-5 pt-5 pb-3 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <Camera className="w-5 h-5" style={{ color: "#4ADE80" }} />Fotografía del incidente
            </h3>
            {cameraMode === "live" && (
              <div className="flex items-center gap-2">
                <button onClick={() => setCameraFacing(f => f === "environment" ? "user" : "environment")} className="text-xs font-semibold px-2.5 py-1 rounded-lg" style={{ backgroundColor: "#E3F2FD", color: "#00D4FF" }}>🔄 Cambiar</button>
                <button onClick={() => setCameraMode("idle")} className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-gray-100 text-gray-600">Cancelar</button>
              </div>
            )}
          </div>

          {cameraMode === "live" && (
            <div className="relative bg-black" style={{ aspectRatio: "16/9" }}>
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" style={cameraFacing === "user" ? { transform: "scaleX(-1)" } : {}} />
              {cameraReady && (
                <div className="absolute inset-6 pointer-events-none">
                  {(["tl", "tr", "bl", "br"] as const).map(corner => (
                    <div key={corner} className="absolute w-7 h-7 border-white" style={{
                      top: corner.startsWith("t") ? 0 : "auto", bottom: corner.startsWith("b") ? 0 : "auto",
                      left: corner.endsWith("l") ? 0 : "auto", right: corner.endsWith("r") ? 0 : "auto",
                      borderTopWidth: corner.startsWith("t") ? 2 : 0, borderBottomWidth: corner.startsWith("b") ? 2 : 0,
                      borderLeftWidth: corner.endsWith("l") ? 2 : 0, borderRightWidth: corner.endsWith("r") ? 2 : 0,
                      borderRadius: corner === "tl" ? "4px 0 0 0" : corner === "tr" ? "0 4px 0 0" : corner === "bl" ? "0 0 0 4px" : "0 0 4px 0",
                    }} />
                  ))}
                </div>
              )}
              {!cameraReady && !cameraError && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 gap-3">
                  <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  <span className="text-white/70 text-xs">Iniciando cámara...</span>
                </div>
              )}
              {cameraError && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 gap-3 px-8 text-center">
                  <Camera className="w-10 h-10 text-white/30" />
                  <p className="text-white/70 text-sm">{cameraError}</p>
                  <button onClick={() => startCamera(cameraFacing)} className="text-xs font-semibold px-4 py-2 rounded-lg bg-white/20 text-white">Reintentar</button>
                </div>
              )}
              {cameraReady && <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-black/40 rounded-full px-2.5 py-1"><div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" /><span className="text-white text-xs font-semibold">EN VIVO</span></div>}
            </div>
          )}

          {cameraMode === "idle" && imagePreview && (
            <div className="relative px-5 pb-1">
              <img src={imagePreview} alt="Vista previa" className="w-full h-56 object-cover rounded-xl bg-gray-100" />
              <div className="absolute top-2 right-7 flex gap-2">
                <button onClick={() => fileInputRef.current?.click()} className="bg-white rounded-full px-3 py-1.5 shadow text-xs font-semibold text-gray-700 flex items-center gap-1"><Upload className="w-3 h-3" /> Cambiar</button>
                <button onClick={() => { setImagePreview(null); setImageFileName(null); }} className="bg-white rounded-full p-1.5 shadow"><X className="w-4 h-4 text-gray-600" /></button>
              </div>
              {imageFileName && <div className="mt-2 text-xs text-gray-400 flex items-center gap-1"><CheckCircle className="w-3 h-3 text-green-500" />{imageFileName}</div>}
            </div>
          )}

          {cameraMode === "idle" && !imagePreview && (
            <div className="px-5 pb-1">
              <div className="border-2 border-dashed border-gray-200 rounded-xl bg-gray-50 p-6 text-center">
                <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3"><Upload className="w-6 h-6 text-gray-300" /></div>
                <p className="text-sm text-gray-500 mb-4">JPG, PNG o WEBP · Máx. 10 MB</p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={() => fileInputRef.current?.click()} className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold" style={{ backgroundColor: "rgba(74,222,128,0.12)", color: "#4ADE80" }}><Upload className="w-4 h-4" /> Galería / Archivos</motion.button>
                  <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={() => setCameraMode("live")} className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold" style={{ backgroundColor: "#E3F2FD", color: "#00D4FF" }}><Camera className="w-4 h-4" /> Usar cámara</motion.button>
                </div>
              </div>
            </div>
          )}

          {cameraMode === "live" && (
            <div className="flex items-center justify-center py-4 gap-6 bg-gray-50 border-t border-gray-100">
              <button onClick={() => fileInputRef.current?.click()} className="flex flex-col items-center gap-1 text-gray-500">
                <div className="w-10 h-10 rounded-xl bg-gray-200 flex items-center justify-center"><Upload className="w-5 h-5 text-gray-500" /></div>
                <span className="text-[10px]">Galería</span>
              </button>
              <button onClick={capturePhoto} disabled={!cameraReady || !!cameraError} className="w-16 h-16 rounded-full border-4 flex items-center justify-center active:scale-90 transition-transform disabled:opacity-40" style={{ borderColor: "#4ADE80", backgroundColor: "white" }}>
                <div className="w-11 h-11 rounded-full" style={{ backgroundColor: "#4ADE80" }} />
              </button>
              <button onClick={() => setCameraFacing(f => f === "environment" ? "user" : "environment")} className="flex flex-col items-center gap-1 text-gray-500">
                <div className="w-10 h-10 rounded-xl bg-gray-200 flex items-center justify-center text-lg">🔄</div>
                <span className="text-[10px]">Voltear</span>
              </button>
            </div>
          )}

          <div className="px-5 pb-4 pt-2 flex items-start gap-2">
            <Info className="w-3.5 h-3.5 text-gray-300 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-gray-400">Una foto nítida ayuda a que la comunidad comprenda mejor el problema.</p>
          </div>
        </div>

        {/* Location card */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2"><MapPin className="w-5 h-5" style={{ color: "#4ADE80" }} />Ubicación del problema</h3>
          <div className="flex gap-2 mb-4">
            {(["gps", "manual"] as const).map(m => (
              <button key={m} onClick={() => setLocationMode(m)} className="flex-1 py-2 rounded-xl text-sm font-semibold transition-colors" style={locationMode === m ? { backgroundColor: "#4ADE80", color: "white" } : { backgroundColor: "#F5F7F5", color: "#555" }}>
                {m === "gps" ? "📍 GPS en tiempo real" : "✏️ Ingresar dirección"}
              </button>
            ))}
          </div>
          {locationMode === "gps" && (
            <div className="space-y-2">
              {geo.status === "idle" && <div className="rounded-xl p-3.5 flex items-center gap-2.5 bg-gray-50"><div className="w-2.5 h-2.5 rounded-full bg-gray-300" /><span className="text-sm text-gray-400">Esperando ubicación...</span></div>}
              {geo.status === "locating" && <div className="rounded-xl p-3.5 flex items-center gap-2.5" style={{ backgroundColor: "#E3F2FD" }}><div className="w-4 h-4 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin flex-shrink-0" /><span className="text-sm font-medium text-blue-700">Obteniendo señal GPS...</span></div>}
              {geo.status === "found" && geo.lat !== null && geo.lng !== null && (
                <>
                  <div className="rounded-xl p-3.5" style={{ backgroundColor: "rgba(74,222,128,0.12)" }}>
                    <div className="flex items-center gap-2 mb-2"><div className="w-2.5 h-2.5 rounded-full animate-pulse flex-shrink-0" style={{ backgroundColor: "#4CAF50" }} /><span className="text-sm font-semibold" style={{ color: "#4ADE80" }}>Ubicación activa · actualizando</span></div>
                    {geo.address ? <p className="text-sm text-gray-800 font-medium mb-2">{geo.address}</p> : <p className="text-sm text-gray-400 italic mb-2">Obteniendo dirección...</p>}
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <span className="text-xs font-mono text-gray-500">{formatCoords(geo.lat, geo.lng)}</span>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: accuracyColor(geo.accuracy ?? 999) }}>{formatAccuracy(geo.accuracy ?? 999)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 px-1">
                    {[{ max: 15, label: "Alta precisión", color: "#4CAF50" }, { max: 50, label: "Media", color: "#FF9800" }, { max: Infinity, label: "Baja", color: "#F44336" }].map(tier => (
                      <div key={tier.label} className="flex items-center gap-1 text-[10px] text-gray-400"><div className="w-2 h-2 rounded-full" style={{ backgroundColor: tier.color }} />{tier.label}</div>
                    ))}
                    <span className="text-[10px] text-gray-300 ml-auto">GPS precisión</span>
                  </div>
                </>
              )}
              {geo.status === "denied" && (
                <div className="rounded-xl p-3.5 border" style={{ backgroundColor: "#FFEBEE", borderColor: "#FFCDD2" }}>
                  <div className="flex items-start gap-2"><AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" /><div><p className="text-sm font-semibold text-red-700">Permiso de ubicación denegado</p><p className="text-xs text-red-500 mt-0.5">Habilita la ubicación en la configuración del navegador o usa la opción "Ingresar dirección".</p><button onClick={startWatchingPosition} className="mt-2 text-xs font-semibold text-red-600 underline">Reintentar</button></div></div>
                </div>
              )}
              {geo.status === "unavailable" && (
                <div className="rounded-xl p-3.5" style={{ backgroundColor: "#FFF3E0" }}>
                  <div className="flex items-start gap-2"><AlertCircle className="w-4 h-4 text-orange-500 flex-shrink-0 mt-0.5" /><p className="text-sm text-orange-700">GPS no disponible. Usa la opción de dirección manual.</p></div>
                </div>
              )}
            </div>
          )}
          {locationMode === "manual" && (
            <div className="space-y-2">
              <div className="relative">
                <input type="text" value={manualAddress} onChange={e => setManualAddress(e.target.value)} placeholder="Ej: Av. Pastor Sevilla con Jr. Los Algarrobos, Sector 3" className="w-full border border-gray-200 rounded-xl px-4 py-2.5 pr-9 text-sm focus:outline-none focus:border-green-600" />
                {manualGeo.loading && <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-gray-200 border-t-green-600 rounded-full animate-spin" />}
                {manualGeo.found && !manualGeo.loading && <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-green-500 flex items-center justify-center"><span className="text-white text-[9px] font-bold">✓</span></div>}
              </div>
              {manualGeo.found && manualGeo.lat !== null && (
                <div className="rounded-xl overflow-hidden border border-green-200">
                  <div ref={manualMapContainerRef} style={{ height: 160 }} />
                  <div className="px-3 py-2 flex items-center gap-2" style={{ backgroundColor: "rgba(74,222,128,0.12)" }}>
                    <MapPin className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#4ADE80" }} />
                    <span className="text-xs font-mono text-gray-600">{Math.abs(manualGeo.lat).toFixed(6)}°S, {Math.abs(manualGeo.lng!).toFixed(6)}°W</span>
                    <span className="text-[10px] text-green-700 font-semibold ml-auto">Ubicación encontrada</span>
                  </div>
                </div>
              )}
              {!manualGeo.found && !manualGeo.loading && manualAddress.length >= 6 && (
                <p className="text-xs text-orange-500 px-1">No se encontró ubicación exacta — se guardará la dirección como texto.</p>
              )}
              <p className="text-xs text-gray-400 px-1">Escribe la dirección o referencia más cercana al problema.</p>
            </div>
          )}
        </div>

        {/* Type */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h3 className="font-semibold text-gray-900 mb-3">Tipo de contaminación</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {reportTypes.map(type => {
              const cfg = TYPE_CONFIG[type]; const Icon = cfg.icon; const sel = selectedType === type;
              return (
                <button key={type} onClick={() => setSelectedType(type)} className="flex flex-col items-center gap-1.5 p-3.5 rounded-xl border-2 transition-all text-xs font-medium" style={sel ? { borderColor: "#4ADE80", backgroundColor: "rgba(74,222,128,0.12)" } : { borderColor: "#F0F0F0" }}>
                  <Icon className="w-5 h-5" style={{ color: sel ? "#4ADE80" : cfg.color }} />
                  <span style={{ color: sel ? "#4ADE80" : "#555" }}>{cfg.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Description */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h3 className="font-semibold text-gray-900 mb-3">Descripción del problema</h3>
          <textarea value={description} onChange={e => setDescription(e.target.value.slice(0, 500))} placeholder="Describe el problema: ¿qué observas?, ¿desde cuándo?, ¿qué impacto tiene en la comunidad?" rows={4} className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none" style={{ borderColor: description.length > 0 ? "#4ADE80" : "" }} />
          <div className="text-right text-xs text-gray-400 mt-1">{description.length}/500</div>
        </div>

        {/* Checklist */}
        <div className="rounded-xl px-4 py-3 flex items-start gap-3" style={{ backgroundColor: "#FFF8E1" }}>
          <Info className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "#FBBF24" }} />
          <div className="space-y-1">
            {[
              { label: "Foto adjunta", ok: !!imagePreview },
              { label: "Ubicación obtenida", ok: geo.status === "found" || (locationMode === "manual" && manualAddress.length > 5) },
              { label: "Tipo seleccionado", ok: !!selectedType },
              { label: "Descripción (mín. 20 caracteres)", ok: description.length >= 20 },
            ].map(item => (
              <div key={item.label} className="flex items-center gap-1.5 text-xs" style={{ color: item.ok ? "#4ADE80" : "#999" }}>
                <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: item.ok ? "#4CAF50" : "#DDD" }} />
                {item.label}
              </div>
            ))}
          </div>
        </div>

        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={handleSubmit} disabled={!selectedType || description.length < 20 || submitting} className="w-full text-white py-4 rounded-xl font-semibold flex items-center justify-center gap-2 shadow-lg disabled:opacity-40 disabled:cursor-not-allowed" style={{ backgroundColor: "#4ADE80" }}>
          {submitting ? <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Analizando con IA...</> : <><Send className="w-5 h-5" />Enviar reporte</>}
        </motion.button>
      </div>
    </div>
  );
}

// ==================== AI ANALYSIS PAGE ====================

const AI_STEPS = [
  "Preparando vista previa...",
  "Revisando los datos del formulario...",
  "Leyendo la descripción...",
  "Organizando el tipo de incidencia...",
  "Aplicando reglas orientativas...",
  "Preparando el resumen...",
  "Mostrando sugerencias de seguimiento...",
  "Resumen listo ✓",
];

function AIAnalysisPage({ analysisData, setPage, addReport, user }: { analysisData: any; setPage: (p: Page) => void; addReport: (r: SubmittedReport) => Promise<void>; user: GoogleUser | null }) {
  const [stage, setStage] = useState<"loading" | "result">("loading");
  const [progress, setProgress] = useState(0);
  const [stepIdx, setStepIdx] = useState(0);

  useEffect(() => {
    const pTimer = setInterval(() => {
      setProgress(p => { if (p >= 100) { clearInterval(pTimer); setTimeout(() => setStage("result"), 400); return 100; } return p + 2; });
    }, 70);
    const sTimer = setInterval(() => setStepIdx(s => Math.min(s + 1, AI_STEPS.length - 1)), 620);
    return () => { clearInterval(pTimer); clearInterval(sTimer); };
  }, []);

  const detectedType: ReportType = analysisData?.type || "basura";
  const typeCfg = TYPE_CONFIG[detectedType];
  const desc: string = analysisData?.description || "";

  const baseConf: Record<ReportType, number> = { quema: 95, aguas: 91, aire: 86, basura: 92, escombros: 88, otros: 81 };
  const severeWords = ["urgente", "grave", "crítico", "tóxico", "desde hace días", "semanas", "ríos", "niños", "hospital", "acumulado", "extendido", "incendio"];
  const mildWords = ["pequeño", "leve", "poco", "mínimo", "reciente", "único"];
  const severeBoost = severeWords.filter(w => desc.toLowerCase().includes(w)).length;
  const mildPenalty = mildWords.filter(w => desc.toLowerCase().includes(w)).length;
  const rawConf = Math.min(99, Math.max(72, baseConf[detectedType] + severeBoost * 1.5 - mildPenalty * 2 + (desc.length > 80 ? 2 : 0)));
  const aiConfidence = rawConf.toFixed(1);
  const isSevere = severeBoost >= 2 || detectedType === "quema" || detectedType === "aguas";
  const severityLabel = isSevere ? "Alto" : severeBoost === 1 ? "Medio-Alto" : "Medio";
  const priorityLabel = isSevere ? "Urgente" : "Normal";
  const areaEstimate = { quema: "~800 m²", aguas: "~200 m lineales", aire: "~1.2 km²", basura: "~150 m²", escombros: "~80 m²", otros: "~100 m²" }[detectedType];
  const riskLabel = { quema: "Muy Alto", aguas: "Alto", aire: "Alto", basura: "Medio-Alto", escombros: "Medio", otros: "Bajo-Medio" }[detectedType];

  const RECS_BY_TYPE: Record<ReportType, string[]> = {
    basura: ["Notificación a la Subgerencia de Limpieza Pública de VES","Recolección prioritaria programada en las próximas 24 h","Inspección del punto para identificar si es vertido recurrente","Colocación de señalética preventiva y papeleras"],
    quema: ["Coordinación inmediata con el Cuerpo de Bomberos (116)","Solicitud a serenazgo para despejar el área y prevenir expansión","Notificación a DIGESA por riesgo de contaminación atmosférica","Registro y seguimiento del foco de quema en el sistema municipal"],
    aguas: ["Notificación urgente a SEDAPAL (0800-1-0900)","Muestreo y análisis de calidad del agua por el MINSA","Señalización del área para prevenir contacto de vecinos y menores","Reparación de infraestructura hidráulica o alcantarillado afectado"],
    escombros: ["Coordinación con la empresa municipal de limpieza para retiro","Identificación del responsable del vertido ilegal de escombros","Inspección de la vía para evaluar riesgo de accidentes","Gestión de disposición en relleno sanitario autorizado"],
    aire: ["Monitoreo con estación móvil de calidad del aire del SENAMHI","Notificación a OEFA para inspección de fuente emisora","Difusión de alerta preventiva a vecinos del sector","Restricción temporal de actividades generadoras si procede"],
    otros: ["Evaluación in situ por técnicos de la Subgerencia de Medio Ambiente","Notificación a la entidad competente según el tipo de problema","Documentación fotográfica adicional para el expediente técnico","Seguimiento semanal hasta la resolución del problema"],
  };
  const recs = RECS_BY_TYPE[detectedType];

  return (
    <div className="min-h-screen bg-background pb-8">
      <div className="text-white px-4 py-6" style={{ background: "linear-gradient(135deg, #1565C0, #00D4FF)" }}>
        <h1 className="text-2xl font-bold">Revisión del reporte</h1>
        <p className="text-white/70 text-sm">Clasificación orientativa basada en tu descripción</p>
      </div>
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {stage === "loading" ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-card rounded-2xl p-7 shadow-sm border border-border">
            <div className="flex flex-col items-center mb-6">
              <div className="w-20 h-20 rounded-full flex items-center justify-center mb-4" style={{ backgroundColor: "#E3F2FD" }}><Cpu className="w-10 h-10 animate-pulse" style={{ color: "#00D4FF" }} /></div>
              <h2 className="text-lg font-bold text-foreground mb-1">Analizando reporte...</h2>
              <p className="text-sm text-muted-foreground">El sistema está procesando los datos del reporte</p>
            </div>
            <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-3 mb-1.5">
              <motion.div className="h-3 rounded-full" style={{ width: `${progress}%`, background: "linear-gradient(90deg, #00D4FF, #4ADE80)" }} transition={{ duration: 0.1 }} />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground mb-6"><span>{AI_STEPS[stepIdx]}</span><span className="font-semibold">{progress}%</span></div>
            <div className="space-y-2">
              {AI_STEPS.map((step, i) => (
                <div key={step} className={`flex items-center gap-2 text-sm transition-opacity ${i <= stepIdx ? "opacity-100" : "opacity-25"}`}>
                  {i < stepIdx ? <CheckCircle className="w-4 h-4 flex-shrink-0" style={{ color: "#4CAF50" }} /> : i === stepIdx ? <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin flex-shrink-0" style={{ borderColor: "#00D4FF" }} /> : <div className="w-4 h-4 border border-border rounded-full flex-shrink-0" />}
                  <span className="text-foreground">{step}</span>
                </div>
              ))}
            </div>
          </motion.div>
        ) : (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <div className="bg-card rounded-2xl p-6 shadow-sm border border-border">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: "#FFEBEE" }}><AlertTriangle className="w-6 h-6" style={{ color: "#D32F2F" }} /></div>
                <div>
                  <h2 className="font-bold text-foreground text-lg">Resumen de tu reporte</h2>
                  <p className="text-sm text-muted-foreground">Revisa los datos antes de publicar</p>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
                {[
                  { label: "Tipo detectado", value: typeCfg.label, bg: typeCfg.bg, color: typeCfg.color },
                  { label: "Gravedad", value: severityLabel, bg: isSevere ? "#FFEBEE" : "#FFF3E0", color: isSevere ? "#D32F2F" : "#FBBF24" },
                  { label: "Puntuación orientativa", value: `${aiConfidence}%`, bg: "#E3F2FD", color: "#00D4FF" },
                  { label: "Prioridad", value: priorityLabel, bg: isSevere ? "#FFEBEE" : "rgba(74,222,128,0.12)", color: isSevere ? "#D32F2F" : "#4ADE80" },
                  { label: "Área afectada", value: "Sin medir", bg: "#F3E5F5", color: "#818CF8" },
                  { label: "Evaluación en campo", value: "Pendiente", bg: "#FCE4EC", color: "#C2185B" },
                ].map(item => (
                  <div key={item.label} className="rounded-xl p-3" style={{ backgroundColor: item.bg }}>
                    <div className="text-xs text-gray-500 mb-0.5">{item.label}</div>
                    <div className="font-bold text-sm" style={{ color: item.color }}>{item.value}</div>
                  </div>
                ))}
              </div>
              <div className="mb-1.5 flex justify-between text-xs text-muted-foreground"><span>Puntuación de las reglas de clasificación</span><span className="font-semibold" style={{ color: "#00D4FF" }}>{aiConfidence}%</span></div>
              <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-2.5">
                <motion.div initial={{ width: 0 }} animate={{ width: `${aiConfidence}%` }} transition={{ duration: 1.2, ease: "easeOut" }} className="h-2.5 rounded-full" style={{ background: "linear-gradient(90deg, #00D4FF, #4ADE80)" }} />
              </div>
            </div>

            <div className="bg-card rounded-2xl p-6 shadow-sm border border-border">
              <h3 className="font-bold text-foreground mb-4">Posibles acciones de seguimiento</h3>
              <p className="text-sm text-muted-foreground mb-4">Son sugerencias orientativas. Publicar aquí no envía avisos a autoridades ni programa una atención municipal.</p>
              <div className="space-y-3">
                {recs.map((rec, i) => (
                  <div key={i} className="flex items-start gap-3 text-sm text-foreground">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-xs font-bold text-white" style={{ backgroundColor: "#4ADE80" }}>{i + 1}</div>
                    {rec}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl p-4 flex items-center gap-3" style={{ background: "linear-gradient(135deg, #E65100, #FBBF24)" }}>
              <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                <Trophy className="w-6 h-6 text-white" />
              </div>
              <div className="text-white">
                <div className="font-bold text-sm">+50 puntos al confirmar</div>
                <div className="text-xs text-white/80">Tu progreso se guarda automáticamente en tu perfil</div>
              </div>
            </div>

            <div className="flex gap-3">
              <motion.button
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                onClick={() => {
                  const now = new Date();
                  addReport({
                    id: `SR-${Date.now()}`,
                    type: analysisData?.type || "basura",
                    description: analysisData?.description || "",
                    imageUrl: analysisData?.imagePreview || null,
                    location: analysisData?.locationText || "Villa El Salvador, Lima",
                    lat: analysisData?.location?.lat ?? null,
                    lng: analysisData?.location?.lng ?? null,
                    date: now.toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" }),
                    time: now.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" }),
                    upvotes: 0,
                    userName: analysisData?.userName || user?.name || "Anónimo",
                    userPhoto: analysisData?.userPhoto || user?.photoUrl || null,
                  });
                }}
                className="flex-1 text-white py-3.5 rounded-xl font-semibold shadow-md"
                style={{ backgroundColor: "#4ADE80" }}
              >
                ✓ Confirmar y publicar
              </motion.button>
              <button onClick={() => setPage("report")} className="flex-1 border border-gray-200 text-gray-600 py-3.5 rounded-xl font-semibold hover:bg-gray-50">
                Nuevo reporte
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

// ==================== MAP PAGE ====================

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

const VES_CENTER: [number, number] = [-12.2130, -76.9300];
const VES_ZOOM = 13;
const VES_BOUNDARY: [number, number][] = [[-12.1750, -76.9720], [-12.1750, -76.8980], [-12.2550, -76.8980], [-12.2550, -76.9720], [-12.1750, -76.9720]];

const TILES = {
  satellite: { url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", attribution: "Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics, USGS", maxZoom: 19 },
  streets: { url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", attribution: "© <a href='https://www.openstreetmap.org/copyright'>OpenStreetMap</a> contributors", maxZoom: 19 },
  topo: { url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png", attribution: "© OpenStreetMap contributors, SRTM | Map style © OpenTopoMap", maxZoom: 17 },
};

const PULSE_CSS = `
  @keyframes eco-ring { 0% { transform: scale(0.5); opacity: 0.8; } 100% { transform: scale(2.8); opacity: 0; } }
  .leaflet-popup-content-wrapper { border-radius: 14px !important; padding: 0 !important; overflow: hidden; box-shadow: 0 8px 32px rgba(0,0,0,0.18) !important; }
  .leaflet-popup-content { margin: 0 !important; }
  .leaflet-popup-tip-container { display: none; }
  .leaflet-container { font-family: 'Roboto', sans-serif; }
`;

function makeSeverityIcon(severity: Severity, active = false): L.DivIcon {
  const colors: Record<Severity, string> = { bajo: "#4CAF50", medio: "#FF9800", alto: "#F44336" };
  const color = colors[severity]; const s = active ? 26 : 18;
  const ring = severity === "alto" ? `<div style="position:absolute;width:${s * 2.6}px;height:${s * 2.6}px;top:${-s * 0.8}px;left:${-s * 0.8}px;border-radius:50%;border:2px solid ${color};opacity:0;animation:eco-ring 2s ease-out infinite;"></div>` : "";
  return L.divIcon({
    html: `<div style="position:relative;width:${s}px;height:${s}px">${ring}<div style="width:${s}px;height:${s}px;border-radius:50%;background:${color};border:${active ? 3 : 2.5}px solid white;box-shadow:0 2px 10px rgba(0,0,0,${active ? 0.5 : 0.35})"></div></div>`,
    iconSize: [s, s], iconAnchor: [s / 2, s / 2], popupAnchor: [0, -s / 2 - 6], className: "",
  });
}

function escapePopup(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]!));
}
function safePopupImage(value: string | null): string {
  return value && /^(https?:\/\/|data:image\/(jpeg|png|webp);base64,)/i.test(value) ? escapePopup(value) : "";
}
function makeLivePopupHtml(r: SubmittedReport): string {
  const tc = TYPE_CONFIG[r.type] || TYPE_CONFIG["otros"];
  const desc = r.description.length > 120 ? r.description.slice(0, 120) + "…" : r.description;
  const imgBlock = r.imageUrl
    ? `<img src="${safePopupImage(r.imageUrl)}" alt="" style="width:100%;height:140px;object-fit:cover;display:block;background:#f5f5f5" onerror="this.style.display='none'"/>`
    : `<div style="width:100%;height:70px;background:${tc.bg};display:flex;align-items:center;justify-content:center;font-size:28px;opacity:0.5">📷</div>`;
  const coords = r.lat !== null ? `<div style="font-family:monospace;font-size:10px;color:#aaa;margin-top:2px">${Math.abs(r.lat).toFixed(5)}°S ${Math.abs(r.lng!).toFixed(5)}°W</div>` : "";
  const avatar = r.userPhoto ? `<img src="${safePopupImage(r.userPhoto)}" alt="" style="width:18px;height:18px;border-radius:50%;object-fit:cover;margin-right:4px;vertical-align:middle" onerror="this.style.display='none'"/>` : "";
  return `<div style="width:282px;font-family:'Roboto',sans-serif;overflow:hidden;border-radius:0">
    <div style="position:relative">${imgBlock}
      <div style="position:absolute;top:8px;left:8px;display:flex;gap:4px">
        <span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:20px;background:${tc.bg};color:${tc.color}">${tc.label}</span>
        <span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:20px;background:#E3F2FD;color:#1565C0">🔴 EN VIVO</span>
      </div>
    </div>
    <div style="padding:10px 12px 12px">
      <p style="font-size:12px;color:#444;line-height:1.55;margin:0 0 8px">${escapePopup(desc)}</p>
      <div style="font-size:11px;color:#777;line-height:1.8">
        <div>📍 ${escapePopup(r.location)}</div>
        <div>🕐 ${escapePopup(r.date)} · ${escapePopup(r.time)}</div>
        <div>${avatar}${escapePopup(r.userName)}</div>
        ${coords}
      </div>
    </div>
  </div>`;
}

function makePopupHtml(report: Report): string {
  const tc = TYPE_CONFIG[report.type]; const sc = SEVERITY_CONFIG[report.severity]; const stc = STATUS_CONFIG[report.status];
  const desc = report.description.length > 110 ? report.description.slice(0, 110) + "…" : report.description;
  return `<div style="width:278px;font-family:'Roboto',sans-serif;overflow:hidden">
    <div style="position:relative">
      <img src="${report.imageUrl}" alt="" style="width:100%;height:130px;object-fit:cover;display:block;background:#f0f0f0" onerror="this.src='https://images.unsplash.com/photo-1662534264036-7bfa0d35de9c?w=400&h=250&fit=crop&q=80'"/>
      <div style="position:absolute;top:8px;left:8px;display:flex;gap:4px;flex-wrap:wrap">
        <span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:20px;background:${sc.bg};color:${sc.color}">● ${sc.label}</span>
        <span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:20px;background:${stc.bg};color:${stc.color}">${stc.label}</span>
      </div>
    </div>
    <div style="padding:10px 12px 12px">
      <div style="margin-bottom:6px"><span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:20px;background:${tc.bg};color:${tc.color}">${tc.label}</span></div>
      <p style="font-size:12px;color:#444;line-height:1.55;margin:0 0 8px">${desc}</p>
      <div style="font-size:11px;color:#777;line-height:1.7">
        <div>📍 ${report.location}</div><div>🏘 ${report.sector}</div><div>👤 ${report.user} · ${report.date}</div>
        <div style="display:flex;align-items:center;margin-top:2px"><span>⭐ ${report.votes} apoyos</span><span style="margin-left:auto;font-size:10px;color:#aaa;font-family:monospace">${Math.abs(report.lat).toFixed(4)}°S ${Math.abs(report.lng).toFixed(4)}°W</span></div>
      </div>
    </div>
  </div>`;
}

function MapPage({ liveReports = [] }: { liveReports?: SubmittedReport[] }) {
  const mapElRef = useRef<HTMLDivElement>(null);
  const mapInst = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const markerGroup = useRef<L.LayerGroup | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [filterType, setFilterType] = useState<ReportType | "all">("all");
  const [filterSeverity, setFilterSeverity] = useState<Severity | "all">("all");
  const [filterStatus, setFilterStatus] = useState<ReportStatus | "all">("all");
  const [showFilters, setShowFilters] = useState(false);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [tileKey, setTileKey] = useState<"satellite" | "streets" | "topo">("satellite");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);

  useEffect(() => {
    if (!mapElRef.current || mapInst.current) return;
    if (!document.getElementById("eco-pulse-css")) { const s = document.createElement("style"); s.id = "eco-pulse-css"; s.textContent = PULSE_CSS; document.head.appendChild(s); }
    const map = L.map(mapElRef.current, { center: VES_CENTER, zoom: VES_ZOOM, zoomControl: false });
    L.control.zoom({ position: "bottomright" }).addTo(map);
    L.polygon(VES_BOUNDARY, { color: "#4ADE80", weight: 2.5, dashArray: "8 5", fillColor: "#4ADE80", fillOpacity: 0.06, opacity: 0.7 }).addTo(map);
    markerGroup.current = L.layerGroup().addTo(map);
    mapInst.current = map;
    setMapReady(true);
    return () => { map.remove(); mapInst.current = null; markerGroup.current = null; document.getElementById("eco-pulse-css")?.remove(); };
  }, []);

  useEffect(() => {
    const map = mapInst.current; if (!map || !mapReady) return;
    if (tileLayerRef.current) map.removeLayer(tileLayerRef.current);
    const t = TILES[tileKey];
    tileLayerRef.current = L.tileLayer(t.url, { attribution: t.attribution, maxZoom: t.maxZoom }).addTo(map);
    tileLayerRef.current.bringToBack();
  }, [tileKey, mapReady]);

  useEffect(() => {
    const group = markerGroup.current; if (!group || !mapReady) return;
    group.clearLayers();
    const filtered = REPORTS.filter(r => {
      if (filterType !== "all" && r.type !== filterType) return false;
      if (filterSeverity !== "all" && r.severity !== filterSeverity) return false;
      if (filterStatus !== "all" && r.status !== filterStatus) return false;
      return true;
    });
    if (showHeatmap) filtered.forEach(r => {
      const color = r.severity === "alto" ? "#F44336" : r.severity === "medio" ? "#FF9800" : "#4CAF50";
      L.circle([r.lat, r.lng], { radius: r.severity === "alto" ? 220 : r.severity === "medio" ? 160 : 110, color: "transparent", fillColor: color, fillOpacity: 0.2, stroke: false }).addTo(group);
    });
    filtered.forEach(report => {
      const icon = makeSeverityIcon(report.severity, activeId === report.id);
      const marker = L.marker([report.lat, report.lng], { icon });
      marker.bindPopup(makePopupHtml(report), { minWidth: 280, maxWidth: 280, autoPan: true });
      marker.on("click", () => setActiveId(report.id));
      marker.on("popupclose", () => setActiveId(null));
      marker.addTo(group);
    });
    liveReports.filter(r => r.lat !== null && r.lng !== null).forEach(r => {
      const liveSev: Severity = ["quema", "aguas"].includes(r.type) ? "alto" : ["escombros", "aire"].includes(r.type) ? "medio" : "bajo";
      const liveColor = liveSev === "alto" ? "#D32F2F" : liveSev === "medio" ? "#FBBF24" : "#4ADE80";
      const liveIcon = L.divIcon({
        html: `<div style="position:relative"><div style="width:26px;height:26px;border-radius:50%;background:${liveColor};border:2.5px solid white;box-shadow:0 2px 10px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center"><div style="width:9px;height:9px;border-radius:50%;background:white"></div></div><div style="position:absolute;top:-4px;right:-4px;width:11px;height:11px;border-radius:50%;background:#FF1744;border:1.5px solid white;animation:eco-ring 1.5s ease-out infinite"></div></div>`,
        iconSize: [26, 26], iconAnchor: [13, 13], popupAnchor: [0, -16], className: "",
      });
      const m = L.marker([r.lat!, r.lng!], { icon: liveIcon });
      m.bindPopup(makeLivePopupHtml(r), { minWidth: 284, maxWidth: 284, autoPan: true });
      m.addTo(group);
    });
  }, [filterType, filterSeverity, filterStatus, showHeatmap, activeId, mapReady, liveReports]);

  const filtered = REPORTS.filter(r => (filterType === "all" || r.type === filterType) && (filterSeverity === "all" || r.severity === filterSeverity) && (filterStatus === "all" || r.status === filterStatus));

  return (
    <div className="min-h-screen bg-background pb-8">
      <div className="text-white px-4 py-4" style={{ backgroundColor: "#1565C0" }}>
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <div><h1 className="text-xl font-bold">Mapa Interactivo</h1><p className="text-white/70 text-sm">{filtered.length} reporte{filtered.length !== 1 ? "s" : ""} en Villa El Salvador</p></div>
          <div className="flex gap-2">
            <button onClick={() => setShowHeatmap(!showHeatmap)} className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors" style={showHeatmap ? { backgroundColor: "white", color: "#1565C0" } : { backgroundColor: "rgba(255,255,255,0.2)", color: "white" }}>🔥 Mapa de calor</button>
            <button onClick={() => setShowFilters(!showFilters)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold" style={{ backgroundColor: "rgba(255,255,255,0.2)", color: "white" }}><Filter className="w-3.5 h-3.5" />Filtros</button>
          </div>
        </div>
      </div>
      {showFilters && (
        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} className="bg-white border-b border-gray-100 px-4 py-4">
          <div className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { label: "Tipo", value: filterType, onChange: (v: string) => setFilterType(v as any), options: [{ value: "all", label: "Todos los tipos" }, ...Object.entries(TYPE_CONFIG).map(([k, v]) => ({ value: k, label: v.label }))] },
              { label: "Gravedad", value: filterSeverity, onChange: (v: string) => setFilterSeverity(v as any), options: [{ value: "all", label: "Toda gravedad" }, { value: "bajo", label: "Bajo" }, { value: "medio", label: "Medio" }, { value: "alto", label: "Alto" }] },
              { label: "Estado", value: filterStatus, onChange: (v: string) => setFilterStatus(v as any), options: [{ value: "all", label: "Todo estado" }, { value: "pendiente", label: "Pendiente" }, { value: "proceso", label: "En proceso" }, { value: "resuelto", label: "Resuelto" }] },
            ].map(f => (
              <div key={f.label}>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">{f.label}</label>
                <select value={f.value} onChange={e => f.onChange(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none bg-white">
                  {f.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            ))}
          </div>
        </motion.div>
      )}
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex gap-2 mb-3">
          {(["satellite", "streets", "topo"] as const).map(k => (
            <button key={k} onClick={() => setTileKey(k)} className="px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors" style={tileKey === k ? { backgroundColor: "#1565C0", color: "white", borderColor: "#1565C0" } : { backgroundColor: "white", color: "#555", borderColor: "#e0e0e0" }}>
              {{ satellite: "🛰 Satélite", streets: "🗺 Calles", topo: "⛰ Topografía" }[k]}
            </button>
          ))}
        </div>
        <div className="rounded-2xl overflow-hidden shadow-md border border-gray-200 mb-4" style={{ height: 460 }}>
          <div ref={mapElRef} style={{ width: "100%", height: "100%" }} />
        </div>
        <div className="flex flex-wrap gap-3 mb-4">
          {[{ c: "#F44336", l: "Alto" }, { c: "#FF9800", l: "Medio" }, { c: "#4CAF50", l: "Bajo" }].map(({ c, l }) => (
            <div key={l} className="flex items-center gap-1.5 text-xs text-gray-600 bg-white rounded-lg px-3 py-1.5 shadow-sm border border-gray-100">
              <div className="w-3 h-3 rounded-full border border-white shadow-sm" style={{ backgroundColor: c }} />Gravedad {l}
            </div>
          ))}
          <div className="ml-auto text-xs text-gray-400 flex items-center">Villa El Salvador · Lima, Perú · −12.21°S 76.93°W</div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filtered.map(report => (
            <div key={report.id} onClick={() => setSelectedReport(report)} className="bg-white rounded-xl p-3.5 shadow-sm border cursor-pointer hover:shadow-md transition-shadow flex gap-3" style={{ borderColor: activeId === report.id ? "#1565C0" : "#f0f0f0" }}>
              <img src={report.imageUrl} alt="" className="w-16 h-16 rounded-lg object-cover bg-gray-100 flex-shrink-0" onError={e => { (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1662534264036-7bfa0d35de9c?w=400&h=250&fit=crop&q=80"; }} />
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap gap-1 mb-1"><SeverityBadge severity={report.severity} /><StatusBadge status={report.status} /></div>
                <p className="text-xs text-gray-700 line-clamp-2 mb-1">{report.description}</p>
                <div className="text-xs text-gray-400">{report.sector} · {report.date}</div>
              </div>
            </div>
          ))}
          {filtered.length === 0 && <div className="col-span-2 text-center py-10 text-gray-400"><MapPin className="w-10 h-10 mx-auto mb-2 opacity-30" /><p className="text-sm">No hay reportes con los filtros seleccionados</p></div>}
        </div>
      </div>
      {selectedReport && <ReportModal report={selectedReport} onClose={() => setSelectedReport(null)} />}
    </div>
  );
}

// ==================== ALERTS PAGE ====================

const ECO_QUIZ = [
  { q: "¿Qué color de bolsa se usa para residuos plásticos y metal según el MINAM?", opts: ["Verde", "Azul", "Amarillo", "Negro"], correct: 2, exp: "El MINAM asigna el amarillo a plásticos y metales. Verde = orgánicos, Azul = papel/cartón, Negro = no reciclables." },
  { q: "¿Cuál es el límite diario de PM2.5 recomendado por la OMS (µg/m³)?", opts: ["25", "50", "75", "100"], correct: 0, exp: "La OMS fijó en 25 µg/m³ el límite diario. En VES se superó 4x en agosto 2026." },
  { q: "¿Cuánto representa el reciclaje de 1 tonelada de papel en árboles salvados?", opts: ["5 árboles", "7 árboles", "17 árboles", "30 árboles"], correct: 2, exp: "Reciclar 1 tonelada de papel equivale a salvar aproximadamente 17 árboles adultos." },
  { q: "¿Qué teléfono llamas ante una quema ilegal de residuos en Lima?", opts: ["911", "116 (Bomberos)", "105 (PNP)", "0800-1-0900"], correct: 1, exp: "El 116 de los Bomberos atiende quemas ilegales. También puedes reportar al OEFA o a la Municipalidad." },
  { q: "¿Qué entidad fiscaliza el cumplimiento ambiental de empresas en Perú?", opts: ["MINAM", "SENAMHI", "OEFA", "SERPAR"], correct: 2, exp: "OEFA (Organismo de Evaluación y Fiscalización Ambiental) es el ente fiscalizador, no el MINAM." },
  { q: "¿Cuántos litros de agua puede desperdiciar al día un grifo con goteo?", opts: ["5 litros", "15 litros", "30 litros", "60 litros"], correct: 2, exp: "Un grifo con goteo lento puede desperdiciar hasta 30 litros al día, casi 11 000 litros al año." },
  { q: "¿Qué porcentaje de muestras de playas del sur de Lima contiene microplásticos según IMARPE 2026?", opts: ["40%", "65%", "80%", "95%"], correct: 3, exp: "El estudio IMARPE 2026 detectó microplásticos en el 95% de muestras de agua en Lurín y Punta Hermosa." },
  { q: "¿Cada cuántos días pasan los camiones de recolección diferenciada en los sectores 1–4 de VES?", opts: ["Todos los días", "Lunes y jueves", "Martes y viernes", "Solo sábados"], correct: 2, exp: "Los sectores 1–4 tienen recolección diferenciada los martes y viernes." },
];

const WASTE_SORT_ITEMS = [
  { id: "w1", label: "Cáscara de plátano", correct: "verde", emoji: "🍌" },
  { id: "w2", label: "Botella de plástico", correct: "amarillo", emoji: "🍶" },
  { id: "w3", label: "Periódico viejo", correct: "azul", emoji: "📰" },
  { id: "w4", label: "Pila usada", correct: "rojo", emoji: "🔋" },
  { id: "w5", label: "Celular roto", correct: "marron", emoji: "📱" },
  { id: "w6", label: "Restos de comida", correct: "verde", emoji: "🥗" },
  { id: "w7", label: "Lata de aluminio", correct: "amarillo", emoji: "🥫" },
  { id: "w8", label: "Medicamento vencido", correct: "rojo", emoji: "💊" },
];
const WASTE_BINS = [
  { id: "verde", label: "Verde", desc: "Orgánicos", color: "#4CAF50", emoji: "🟢" },
  { id: "azul", label: "Azul", desc: "Papel/cartón", color: "#1565C0", emoji: "🔵" },
  { id: "amarillo", label: "Amarillo", desc: "Plástico/metal", color: "#F9A825", emoji: "🟡" },
  { id: "rojo", label: "Rojo", desc: "Peligrosos", color: "#D32F2F", emoji: "🔴" },
  { id: "marron", label: "Marrón", desc: "RAEE", color: "#795548", emoji: "🟤" },
];

const CARBON_QUESTIONS = [
  { id: "transport", q: "¿Cómo te transportas principalmente?", opts: [{ label: "A pie o bicicleta", kg: 0 }, { label: "Transporte público", kg: 1.2 }, { label: "Auto propio", kg: 4.5 }, { label: "Mototaxi", kg: 2.0 }] },
  { id: "diet", q: "¿Cómo es tu alimentación?", opts: [{ label: "Principalmente vegetal", kg: 1.5 }, { label: "Poca carne (2x/sem)", kg: 2.5 }, { label: "Carne frecuente (5x/sem)", kg: 4.0 }, { label: "Carne en cada comida", kg: 6.0 }] },
  { id: "energy", q: "¿Qué tan eficiente es tu hogar en energía?", opts: [{ label: "Paneles solares / LED", kg: 0.5 }, { label: "Mayoría LED, sin AC", kg: 1.5 }, { label: "Uso normal, AC ocasional", kg: 2.5 }, { label: "Muchos aparatos encendidos", kg: 4.0 }] },
  { id: "waste", q: "¿Cómo manejas tus residuos?", opts: [{ label: "Separo y composito", kg: 0.3 }, { label: "Separo pero no composito", kg: 0.8 }, { label: "Todo en la misma bolsa", kg: 1.5 }, { label: "Quemo o arrojo en lotes", kg: 3.0 }] },
];

const WORKSHOPS = [
  { title: "Compostaje en casa", icon: "🌱", desc: "Convierte tus restos orgánicos en abono en 3 pasos. Necesitas: caja ventilada, restos de comida y hojas secas.", steps: ["Consigue o fabrica una caja con orificios de ventilación de al menos 50 litros.", "Agrega capas alternas: restos verdes (cáscaras, vegetales) y secos (hojas secas, cartón troceado).", "Humedece ligeramente cada 3 días y revuelve semanalmente. En 60–90 días tendrás abono oscuro y sin olor.", "Úsalo en tus macetas o dónalo al programa de compostaje del Sector 5 de VES."] },
  { title: "Detecta puntos críticos en tu barrio", icon: "🔍", desc: "Conviértete en un monitor ambiental vecinal con este protocolo de 10 minutos.", steps: ["Camina 5 cuadras a la redonda y anota: basura acumulada, quema de residuos, malos olores, efluentes oscuros.", "Fotografía cada hallazgo con tu cámara indicando dirección y hora exacta.", "Repórtalo en EcoAlert VES para que quede georreferenciado en el mapa municipal.", "Comparte el reporte con tus vecinos por WhatsApp para sumar apoyos y acelerar la atención."] },
  { title: "Ahorra agua en VES", icon: "💧", desc: "Con el déficit hídrico proyectado para el verano 2026-2027, cada litro cuenta.", steps: ["Cierra el caño mientras te enjabonas — ahorras hasta 12 litros por baño.", "Riega tus plantas al amanecer o de noche para reducir evaporación hasta un 60%.", "Repara grifos con goteo: uno solo puede desperdiciar 30 litros/día, 11 000 l/año.", "Reutiliza el agua del enjuague de verduras para regar macetas."] },
  { title: "Reduce tu huella plástica", icon: "♻️", desc: "7 acciones concretas para eliminar plástico de un solo uso en tu hogar.", steps: ["Lleva bolsas de tela al mercado y tiendas. Guarda 2 en tu mochila o bolso.", "Usa una botella reutilizable — evitas ~180 botellas PET al año.", "Coloca una malla en el desagüe de la lavadora para atrapar fibras sintéticas.", "Compra a granel en los mercados de VES: Mercado de Flores, Mercado Productores."] },
  { title: "Cómo reportar al OEFA", icon: "📋", desc: "Aprende a presentar una denuncia ambiental formal que tenga impacto real.", steps: ["Documenta: fotografías, video, coordenadas GPS, hora y frecuencia del incidente.", "Ingresa a oefa.gob.pe/denuncias o llama al 0800-4-3372 (gratuito).", "Complementa con el reporte en EcoAlert VES para que quede en el mapa municipal.", "Haz seguimiento a tu denuncia con el número de expediente que te asigna el OEFA."] },
];

function WasteSortGame() {
  const [items, setItems] = useState(() => [...WASTE_SORT_ITEMS].sort(() => Math.random() - 0.5));
  const [current, setCurrent] = useState(0);
  const [score, setScore] = useState(0);
  const [feedback, setFeedback] = useState<{ correct: boolean; binLabel: string } | null>(null);
  const [done, setDone] = useState(false);

  const choose = (binId: string) => {
    if (feedback) return;
    const item = items[current];
    const correct = item.correct === binId;
    const bin = WASTE_BINS.find(b => b.id === binId)!;
    if (correct) setScore(s => s + 1);
    setFeedback({ correct, binLabel: bin.label });
    setTimeout(() => {
      setFeedback(null);
      if (current + 1 >= items.length) setDone(true);
      else setCurrent(i => i + 1);
    }, 1200);
  };

  const reset = () => { setItems([...WASTE_SORT_ITEMS].sort(() => Math.random() - 0.5)); setCurrent(0); setScore(0); setFeedback(null); setDone(false); };

  if (done) return (
    <div className="text-center py-6">
      <div className="text-5xl mb-3">{score >= 7 ? "🏆" : score >= 5 ? "♻️" : "📚"}</div>
      <div className="text-2xl font-bold text-gray-900 mb-1">{score} / {items.length}</div>
      <p className="text-sm text-gray-500 mb-5">{score >= 7 ? "¡Maestro del reciclaje! 🌿" : score >= 5 ? "¡Muy bien! Sigue practicando" : "Lee la guía MINAM de colores para mejorar"}</p>
      <button onClick={reset} className="px-6 py-3 rounded-xl font-semibold text-white text-sm" style={{ backgroundColor: "#4ADE80" }}>Jugar de nuevo</button>
    </div>
  );

  const item = items[current];
  return (
    <div>
      <div className="flex justify-between text-xs text-gray-400 mb-3">
        <span>Objeto {current + 1} de {items.length}</span>
        <span className="font-semibold text-green-700">{score} correctos</span>
      </div>
      <div className="flex gap-1 mb-4">{items.map((_, i) => <div key={i} className="flex-1 h-1.5 rounded-full" style={{ backgroundColor: i < current ? "#4CAF50" : i === current ? "#00D4FF" : "#E5E7EB" }} />)}</div>
      <motion.div key={item.id} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center mb-5">
        <div className="text-6xl mb-2">{item.emoji}</div>
        <p className="font-bold text-gray-900 text-lg">{item.label}</p>
        <p className="text-xs text-gray-400 mt-1">¿En qué bolsa va?</p>
      </motion.div>
      {feedback && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-4 py-3 rounded-xl font-semibold text-sm" style={{ backgroundColor: feedback.correct ? "rgba(74,222,128,0.12)" : "#FFEBEE", color: feedback.correct ? "#4ADE80" : "#D32F2F" }}>
          {feedback.correct ? `✓ ¡Correcto! Va en bolsa ${feedback.binLabel}` : `✗ Incorrecto — va en bolsa ${WASTE_BINS.find(b => b.id === item.correct)?.label}`}
        </motion.div>
      )}
      <div className="grid grid-cols-5 gap-2">
        {WASTE_BINS.map(bin => (
          <motion.button key={bin.id} whileTap={{ scale: 0.92 }} onClick={() => choose(bin.id)} disabled={!!feedback} className="flex flex-col items-center gap-1 py-3 rounded-xl border-2 transition-all disabled:opacity-50" style={{ borderColor: bin.color + "40", backgroundColor: bin.color + "10" }}>
            <span className="text-xl">{bin.emoji}</span>
            <span className="text-[10px] font-bold" style={{ color: bin.color }}>{bin.label}</span>
          </motion.button>
        ))}
      </div>
    </div>
  );
}

function CarbonCalcGame() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [done, setDone] = useState(false);

  const choose = (kg: number) => {
    const newAnswers = [...answers, kg];
    setAnswers(newAnswers);
    if (step + 1 >= CARBON_QUESTIONS.length) { setDone(true); }
    else setStep(s => s + 1);
  };
  const reset = () => { setStep(0); setAnswers([]); setDone(false); };
  const total = answers.reduce((s, v) => s + v, 0);

  if (done) {
    const perYear = (total * 365).toFixed(0);
    const trees = Math.ceil(total * 365 / 21.7);
    let msg = ""; let emoji = "";
    if (total <= 4) { msg = "Huella baja — eres un ejemplo en VES"; emoji = "🌳"; }
    else if (total <= 8) { msg = "Huella media — hay margen para mejorar"; emoji = "🌿"; }
    else { msg = "Huella alta — considera cambios en transporte y dieta"; emoji = "⚠️"; }
    return (
      <div className="text-center py-4">
        <div className="text-5xl mb-2">{emoji}</div>
        <div className="text-3xl font-bold text-gray-900 mb-0.5">{total.toFixed(1)} kg CO₂</div>
        <div className="text-xs text-gray-400 mb-4">por día · ~{perYear} kg/año · equivale a {trees} árboles</div>
        <div className="rounded-xl p-4 mb-5 text-sm text-left space-y-1" style={{ backgroundColor: "rgba(74,222,128,0.12)" }}>
          <p className="font-semibold text-gray-800 mb-2">{msg}</p>
          {total > 4 && <p className="text-gray-600 text-xs">• Cambiar el auto por transporte público puede reducir tu huella un 70% en transporte.</p>}
          {total > 6 && <p className="text-gray-600 text-xs">• Reducir carne a 2 veces por semana ahorra ~400 kg CO₂ al año.</p>}
          <p className="text-gray-600 text-xs">• Participar en la jornada de arborización de VES compensa tu huella y mejora el microclima.</p>
        </div>
        <button onClick={reset} className="px-6 py-3 rounded-xl font-semibold text-white text-sm" style={{ backgroundColor: "#4ADE80" }}>Calcular de nuevo</button>
      </div>
    );
  }

  const q = CARBON_QUESTIONS[step];
  return (
    <div>
      <div className="flex gap-1 mb-4">{CARBON_QUESTIONS.map((_, i) => <div key={i} className="flex-1 h-1.5 rounded-full" style={{ backgroundColor: i < step ? "#4CAF50" : i === step ? "#FBBF24" : "#E5E7EB" }} />)}</div>
      <p className="text-xs text-gray-400 mb-1.5">Pregunta {step + 1} de {CARBON_QUESTIONS.length}</p>
      <motion.h3 key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="font-bold text-gray-900 mb-4 leading-snug">{q.q}</motion.h3>
      <div className="space-y-2.5">
        {q.opts.map((opt, i) => (
          <motion.button key={i} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }} onClick={() => choose(opt.kg)} className="w-full text-left px-4 py-3 rounded-xl text-sm font-medium border-2 border-gray-100 hover:border-orange-200 hover:bg-orange-50 transition-all text-gray-700">
            {opt.label} <span className="text-xs text-gray-400 float-right">{opt.kg} kg CO₂/día</span>
          </motion.button>
        ))}
      </div>
    </div>
  );
}

function AlertsPage() {
  const [joined, setJoined] = useState<Set<string>>(new Set());
  const [tab, setTab] = useState<"eventos" | "quiz" | "juegos" | "talleres">("eventos");
  const [quizIdx, setQuizIdx] = useState(0);
  const [quizScore, setQuizScore] = useState(0);
  const [quizAns, setQuizAns] = useState<number | null>(null);
  const [quizDone, setQuizDone] = useState(false);
  const [expandedWorkshop, setExpandedWorkshop] = useState<number | null>(null);
  const [liveParticipants, setLiveParticipants] = useState<Record<string, number>>({});
  const [activeGame, setActiveGame] = useState<"sort" | "carbon" | null>(null);
  const [now, setNow] = useState(new Date());

  // Clock + participant simulation
  useEffect(() => {
    const clockTimer = setInterval(() => setNow(new Date()), 60000);
    // Simulate new participants joining over time (1-3 per 15s per event)
    const partTimer = setInterval(() => {
      setLiveParticipants(prev => {
        const next = { ...prev };
        ECO_ALERTS.forEach(a => {
          const current = (prev[a.id] ?? a.participants);
          const cap = a.maxParticipants;
          if (current < cap - 5) {
            const delta = Math.floor(Math.random() * 2);
            next[a.id] = current + delta;
          }
        });
        return next;
      });
    }, 15000);
    return () => { clearInterval(clockTimer); clearInterval(partTimer); };
  }, []);

  const toggleJoin = (id: string) => setJoined(prev => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n;
  });

  const handleQuizAnswer = (idx: number) => {
    if (quizAns !== null) return;
    setQuizAns(idx);
    if (idx === ECO_QUIZ[quizIdx].correct) setQuizScore(s => s + 1);
  };
  const nextQuestion = () => {
    if (quizIdx + 1 >= ECO_QUIZ.length) { setQuizDone(true); return; }
    setQuizIdx(i => i + 1); setQuizAns(null);
  };
  const resetQuiz = () => { setQuizIdx(0); setQuizScore(0); setQuizAns(null); setQuizDone(false); };

  const getCountdown = (dateStr: string) => {
    const target = new Date(dateStr + "T07:00:00");
    const diff = target.getTime() - now.getTime();
    if (diff <= 0) return { label: "Finalizado", past: true };
    const days = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    if (days === 0 && hours === 0) return { label: "¡Hoy ahora!", past: false };
    if (days === 0) return { label: `${hours}h`, past: false };
    if (days === 1) return { label: "Mañana", past: false };
    return { label: `${days}d ${hours}h`, past: false };
  };

  const TABS: [typeof tab, string][] = [["eventos", "📅 Eventos"], ["quiz", "🧠 Quiz"], ["juegos", "🎮 Juegos"], ["talleres", "🛠 Talleres"]];

  return (
    <div className="min-h-screen bg-background pb-8">
      <div className="text-white px-4 py-6" style={{ background: "linear-gradient(135deg, #4ADE80, #388E3C)" }}>
        <h1 className="text-2xl font-bold">Alertas Ecológicas</h1>
        <p className="text-white/70 text-sm">Eventos en vivo · mini-juegos · talleres ambientales</p>
      </div>
      <div className="bg-card border-b border-border sticky top-14 z-30">
        <div className="max-w-2xl mx-auto px-4 flex gap-0.5 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
          {TABS.map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} className={`flex-shrink-0 px-4 py-3.5 text-sm font-semibold border-b-2 transition-colors ${tab === k ? "border-green-600 text-green-700" : "border-transparent text-gray-500 hover:text-gray-700"}`}>{l}</button>
          ))}
        </div>
      </div>
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">

        {/* EVENTOS */}
        {tab === "eventos" && ECO_ALERTS.map((alert, idx) => {
          const cfg = ALERT_CONFIG[alert.type]; const Icon = cfg.icon;
          const participants = liveParticipants[alert.id] ?? alert.participants;
          const pct = (participants / alert.maxParticipants) * 100;
          const isJoined = joined.has(alert.id);
          const countdown = getCountdown(alert.date);
          return (
            <motion.div key={alert.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.07 }} className="bg-card rounded-2xl overflow-hidden shadow-sm border border-border">
              <div className="h-1.5" style={{ backgroundColor: cfg.color }} />
              <div className="p-5">
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: cfg.bg }}><Icon className="w-6 h-6" style={{ color: cfg.color }} /></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-bold text-gray-900 text-sm leading-snug">{alert.title}</h3>
                      <span className="flex-shrink-0 text-xs font-bold px-2 py-0.5 rounded-full" style={countdown.past ? { backgroundColor: "#F5F5F5", color: "#9E9E9E" } : { backgroundColor: cfg.bg, color: cfg.color }}>
                        {countdown.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-gray-400 mt-1"><Calendar className="w-3 h-3" />{alert.date} · {alert.time}</div>
                    <div className="flex items-center gap-1 text-xs text-gray-400 mt-0.5"><MapPin className="w-3 h-3" />{alert.location}</div>
                  </div>
                </div>
                <p className="text-sm text-gray-600 mb-4">{alert.description}</p>
                <div className="mb-4">
                  <div className="flex justify-between text-xs text-gray-500 mb-1.5">
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      <span className="font-semibold" style={{ color: cfg.color }}>{participants + (isJoined ? 1 : 0)}</span>
                      <span>participantes</span>
                      {!countdown.past && <span className="text-green-500 animate-pulse">● en vivo</span>}
                    </span>
                    <span>{alert.maxParticipants} cupos</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div className="h-2 rounded-full transition-all duration-700" style={{ width: `${Math.min(pct + (isJoined ? (100 / alert.maxParticipants) : 0), 100)}%`, backgroundColor: cfg.color }} />
                  </div>
                  {Math.min(pct, 100) > 80 && <p className="text-xs text-orange-600 mt-1 font-medium">¡Cupos casi agotados!</p>}
                </div>
                {!countdown.past ? (
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} onClick={() => toggleJoin(alert.id)} className="w-full py-2.5 rounded-xl font-semibold text-sm transition-colors" style={isJoined ? { backgroundColor: cfg.color, color: "white" } : { backgroundColor: cfg.bg, color: cfg.color }}>
                    {isJoined ? "✓ Inscrito — Cancelar inscripción" : "Inscribirme al evento"}
                  </motion.button>
                ) : (
                  <div className="w-full py-2.5 rounded-xl text-center text-sm font-semibold text-gray-400 bg-gray-50">Evento finalizado</div>
                )}
              </div>
            </motion.div>
          );
        })}

        {/* QUIZ */}
        {tab === "quiz" && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
            <div className="p-5 text-white" style={{ background: "linear-gradient(135deg, #1565C0, #00D4FF)" }}>
              <h2 className="text-lg font-bold mb-0.5">Quiz Ambiental VES</h2>
              <p className="text-white/70 text-sm">8 preguntas · ¿Cuánto sabes del medio ambiente?</p>
              {!quizDone && <div className="mt-3 flex gap-1">{ECO_QUIZ.map((_, i) => <div key={i} className="flex-1 h-1.5 rounded-full transition-all" style={{ backgroundColor: i < quizIdx ? "#4CAF50" : i === quizIdx ? "white" : "rgba(255,255,255,0.3)" }} />)}</div>}
            </div>
            <div className="p-5">
              {quizDone ? (
                <div className="text-center py-4">
                  <div className="text-5xl mb-3">{quizScore >= 7 ? "🏆" : quizScore >= 5 ? "🌿" : quizScore >= 3 ? "📚" : "🌱"}</div>
                  <h3 className="text-xl font-bold text-gray-900 mb-1">{quizScore} / {ECO_QUIZ.length} correctas</h3>
                  <p className="text-sm text-gray-500 mb-6">{quizScore >= 7 ? "¡Experto ambiental! Tus vecinos te necesitan" : quizScore >= 5 ? "Buen conocimiento, sigue aprendiendo" : quizScore >= 3 ? "Explorar la sección Aprende te ayudará" : "¡Comienza por los artículos básicos!"}</p>
                  <button onClick={resetQuiz} className="px-6 py-3 rounded-xl font-semibold text-white text-sm" style={{ backgroundColor: "#4ADE80" }}>Jugar de nuevo</button>
                </div>
              ) : (
                <>
                  <p className="text-xs text-gray-400 mb-2">Pregunta {quizIdx + 1} de {ECO_QUIZ.length}</p>
                  <motion.h3 key={quizIdx} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} className="font-bold text-gray-900 mb-5 leading-snug">{ECO_QUIZ[quizIdx].q}</motion.h3>
                  <div className="space-y-2.5">
                    {ECO_QUIZ[quizIdx].opts.map((opt, i) => {
                      const isCorrect = i === ECO_QUIZ[quizIdx].correct;
                      const isSelected = quizAns === i;
                      const revealed = quizAns !== null;
                      let bg = "var(--muted)"; let color = "var(--foreground)"; let border = "var(--border)";
                      if (revealed && isCorrect) { bg = "rgba(74,222,128,0.12)"; color = "#4ADE80"; border = "#4CAF50"; }
                      else if (revealed && isSelected && !isCorrect) { bg = "#FFEBEE"; color = "#D32F2F"; border = "#EF5350"; }
                      return (
                        <button key={i} onClick={() => handleQuizAnswer(i)} disabled={revealed} className="w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition-all border-2" style={{ backgroundColor: bg, color, borderColor: border }}>
                          {revealed && isCorrect && "✓ "}{revealed && isSelected && !isCorrect && "✗ "}{opt}
                        </button>
                      );
                    })}
                  </div>
                  {quizAns !== null && (
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-4">
                      <div className="rounded-xl p-3 mb-3 text-sm" style={{ backgroundColor: quizAns === ECO_QUIZ[quizIdx].correct ? "rgba(74,222,128,0.12)" : "#FFEBEE" }}>
                        <p className="font-semibold mb-0.5" style={{ color: quizAns === ECO_QUIZ[quizIdx].correct ? "#4ADE80" : "#D32F2F" }}>
                          {quizAns === ECO_QUIZ[quizIdx].correct ? "¡Correcto! 🎉" : `Incorrecto — respuesta: ${ECO_QUIZ[quizIdx].opts[ECO_QUIZ[quizIdx].correct]}`}
                        </p>
                        <p className="text-xs text-gray-600">{ECO_QUIZ[quizIdx].exp}</p>
                      </div>
                      <button onClick={nextQuestion} className="w-full py-3 rounded-xl font-semibold text-white text-sm" style={{ backgroundColor: "#4ADE80" }}>
                        {quizIdx + 1 >= ECO_QUIZ.length ? "Ver resultados" : "Siguiente →"}
                      </button>
                    </motion.div>
                  )}
                </>
              )}
            </div>
          </motion.div>
        )}

        {/* JUEGOS */}
        {tab === "juegos" && (
          <div className="space-y-4">
            {activeGame === null && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                <div className="rounded-2xl p-4 text-white" style={{ background: "linear-gradient(135deg, #4ADE80, #4CAF50)" }}>
                  <h2 className="text-lg font-bold mb-1">Mini-juegos Ambientales</h2>
                  <p className="text-white/70 text-sm">Aprende jugando sobre el medio ambiente de VES</p>
                </div>
                {[
                  { id: "sort" as const, title: "Clasificador de Residuos", desc: "Arrastra cada objeto al contenedor correcto según el código de colores del MINAM. ¡Rápido y educativo!", emoji: "♻️", color: "#4CAF50", bg: "rgba(74,222,128,0.12)" },
                  { id: "carbon" as const, title: "Calculadora de Huella de Carbono", desc: "Responde 4 preguntas sobre tu estilo de vida y descubre tu huella diaria de CO₂ en VES.", emoji: "🌍", color: "#FBBF24", bg: "#FFF3E0" },
                ].map(g => (
                  <motion.button key={g.id} whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }} onClick={() => setActiveGame(g.id)} className="w-full bg-card rounded-2xl p-5 shadow-sm border border-border flex items-center gap-4 text-left">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl flex-shrink-0" style={{ backgroundColor: g.bg }}>{g.emoji}</div>
                    <div className="flex-1">
                      <h3 className="font-bold text-gray-900 mb-1">{g.title}</h3>
                      <p className="text-xs text-gray-500 leading-snug">{g.desc}</p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                  </motion.button>
                ))}
              </motion.div>
            )}
            {activeGame === "sort" && (
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
                <div className="p-4 text-white flex items-center gap-3" style={{ background: "linear-gradient(135deg, #4ADE80, #4CAF50)" }}>
                  <button onClick={() => setActiveGame(null)} className="text-white/70 hover:text-white text-sm font-medium">← Volver</button>
                  <div>
                    <h2 className="font-bold">Clasificador de Residuos</h2>
                    <p className="text-white/70 text-xs">¿En qué contenedor va cada objeto?</p>
                  </div>
                </div>
                <div className="p-5"><WasteSortGame /></div>
              </motion.div>
            )}
            {activeGame === "carbon" && (
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
                <div className="p-4 text-white flex items-center gap-3" style={{ background: "linear-gradient(135deg, #E65100, #FBBF24)" }}>
                  <button onClick={() => setActiveGame(null)} className="text-white/70 hover:text-white text-sm font-medium">← Volver</button>
                  <div>
                    <h2 className="font-bold">Huella de Carbono</h2>
                    <p className="text-white/70 text-xs">Calcula tu impacto ambiental diario</p>
                  </div>
                </div>
                <div className="p-5"><CarbonCalcGame /></div>
              </motion.div>
            )}
          </div>
        )}

        {/* TALLERES */}
        {tab === "talleres" && WORKSHOPS.map((w, idx) => (
          <motion.div key={w.title} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.06 }} className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
            <button className="w-full p-5 text-left flex items-center gap-4" onClick={() => setExpandedWorkshop(expandedWorkshop === idx ? null : idx)}>
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 text-3xl" style={{ backgroundColor: "rgba(74,222,128,0.12)" }}>{w.icon}</div>
              <div className="flex-1">
                <h3 className="font-bold text-gray-900">{w.title}</h3>
                <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{w.desc}</p>
              </div>
              <ChevronRight className={`w-5 h-5 text-gray-400 flex-shrink-0 transition-transform ${expandedWorkshop === idx ? "rotate-90" : ""}`} />
            </button>
            {expandedWorkshop === idx && (
              <div className="overflow-hidden">
                <div className="px-5 pb-5 border-t border-border">
                  <p className="text-sm text-gray-600 mt-4 mb-4">{w.desc}</p>
                  <div className="space-y-3">
                    {w.steps.map((step, i) => (
                      <div key={i} className="flex items-start gap-3 text-sm text-gray-700">
                        <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-xs font-bold text-white" style={{ backgroundColor: "#4ADE80" }}>{i + 1}</div>
                        {step}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ==================== GAMIFICATION PAGE ====================

function GamificationPage({ userStats, user }: { userStats: UserStats; user: GoogleUser | null }) {
  const me = {
    id: user?.uid || "ME",
    name: user?.name || "Tú",
    points: userStats.points,
    level: userStats.level,
    levelNum: userStats.levelNum,
    reports: userStats.reports,
    resolved: userStats.resolved,
    sector: "Villa El Salvador",
    badges: userStats.badges,
    avatar: user ? user.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase() : "YO",
  };
  const lvlCfg = LEVEL_CONFIG[me.level] || LEVEL_CONFIG["Eco Novato"];
  const progressPct = (me.points / lvlCfg.nextPoints) * 100;
  const allBadges = Object.keys(BADGE_CONFIG);

  return (
    <div className="min-h-screen bg-background pb-8">
      <div className="text-white px-4 py-6" style={{ background: "linear-gradient(135deg, #E65100, #FBBF24)" }}>
        <h1 className="text-2xl font-bold">Gamificación</h1>
        <p className="text-white/70 text-sm">Tu progreso como guardián ambiental de VES</p>
      </div>
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        {/* Profile card */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-4 mb-4">
            {user?.photoUrl ? (
              <img src={user.photoUrl} alt={user.name} className="w-16 h-16 rounded-full border-2 flex-shrink-0" style={{ borderColor: lvlCfg.color }} onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
            ) : (
              <div className="w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-xl flex-shrink-0" style={{ background: `linear-gradient(135deg, ${lvlCfg.color}, ${lvlCfg.color}99)` }}>{me.avatar}</div>
            )}
            <div className="flex-1">
              <h2 className="font-bold text-gray-900 text-lg">{me.name}</h2>
              <span className="inline-block text-sm font-semibold px-3 py-0.5 rounded-full" style={{ backgroundColor: lvlCfg.bg, color: lvlCfg.color }}>⚡ {me.level}</span>
              <div className="text-sm text-gray-400 mt-0.5">{me.sector}</div>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-gray-900">{me.points.toLocaleString()}</div>
              <div className="text-xs text-gray-400">puntos</div>
            </div>
          </div>
          <div className="mb-1 flex justify-between text-xs text-gray-500">
            <span className="font-medium" style={{ color: lvlCfg.color }}>{me.level}</span>
            <span className="text-gray-400">{NEXT_LEVEL[me.level]}</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-3 mb-1">
            <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(progressPct, 100)}%` }} transition={{ duration: 1.5, ease: "easeOut" }} className="h-3 rounded-full" style={{ background: `linear-gradient(90deg, ${lvlCfg.color}, #FFA726)` }} />
          </div>
          <div className="text-xs text-center text-gray-400">
            {me.level !== "Eco Héroe" ? `${(lvlCfg.nextPoints - me.points).toLocaleString()} puntos para ${NEXT_LEVEL[me.level]}` : "¡Nivel máximo alcanzado! 🏆"}
          </div>
          <div className="grid grid-cols-2 gap-3 mt-4">
            <div className="rounded-xl p-3 text-center" style={{ backgroundColor: "rgba(74,222,128,0.12)" }}>
              <div className="text-2xl font-bold" style={{ color: "#4ADE80" }}>{me.reports}</div>
              <div className="text-xs text-gray-600">Reportes enviados</div>
            </div>
            <div className="rounded-xl p-3 text-center" style={{ backgroundColor: "#E3F2FD" }}>
              <div className="text-2xl font-bold" style={{ color: "#00D4FF" }}>{me.resolved}</div>
              <div className="text-xs text-gray-600">Casos resueltos</div>
            </div>
          </div>

          {/* Points per action guide */}
          <div className="mt-4 rounded-xl p-3.5" style={{ backgroundColor: "#FFF8E1" }}>
            <div className="text-xs font-semibold text-gray-700 mb-2">¿Cómo ganar puntos?</div>
            <div className="space-y-1.5">
              {[
                { action: "Enviar un reporte verificado", pts: "+50 pts" },
                { action: "Tu reporte llega a 'Resuelto'", pts: "+30 pts" },
                { action: "Apoyar un reporte de otro ciudadano", pts: "+5 pts" },
              ].map(row => (
                <div key={row.action} className="flex items-center justify-between text-xs">
                  <span className="text-gray-600">{row.action}</span>
                  <span className="font-bold" style={{ color: "#FBBF24" }}>{row.pts}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Levels guide */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h3 className="font-bold text-gray-900 mb-4">Niveles de ciudadanía</h3>
          <div className="grid grid-cols-2 gap-3">
            {[
              { level: "Eco Novato", pts: "0 – 499 pts", num: 1 },
              { level: "Eco Protector", pts: "500 – 1.499 pts", num: 2 },
              { level: "Eco Guardián", pts: "1.500 – 2.499 pts", num: 3 },
              { level: "Eco Héroe", pts: "2.500+ pts", num: 4 },
            ].map(lv => {
              const lc = LEVEL_CONFIG[lv.level];
              const isMe = lv.level === me.level;
              return (
                <div key={lv.level} className="rounded-xl p-3 border-2" style={{ backgroundColor: lc.bg, borderColor: isMe ? lc.color : "transparent" }}>
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ backgroundColor: lc.color }}>{lv.num}</div>
                    {isMe && <span className="text-[10px] text-white font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: lc.color }}>Tú</span>}
                  </div>
                  <div className="font-semibold text-sm" style={{ color: lc.color }}>{lv.level}</div>
                  <div className="text-xs text-gray-500">{lv.pts}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Badges */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h3 className="font-bold text-gray-900 mb-4">Insignias</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {allBadges.map(badge => {
              const cfg = BADGE_CONFIG[badge]; const Icon = cfg.icon; const has = me.badges.includes(badge);
              return (
                <div key={badge} className={`flex flex-col items-center p-3.5 rounded-xl border-2 text-center transition-all ${has ? "" : "opacity-35 grayscale"}`} style={has ? { backgroundColor: cfg.color + "12", borderColor: cfg.color + "35" } : { borderColor: "#F0F0F0" }}>
                  <div className="w-11 h-11 rounded-full flex items-center justify-center mb-2" style={has ? { backgroundColor: cfg.color + "20" } : { backgroundColor: "#F5F5F5" }}>
                    <Icon className="w-5 h-5" style={{ color: has ? cfg.color : "#BBB" }} />
                  </div>
                  <div className="text-xs font-semibold text-gray-800 leading-tight">{cfg.label}</div>
                  <div className="text-[10px] text-gray-400 mt-0.5 leading-tight">{cfg.desc}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Leaderboard */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h3 className="font-bold text-gray-900 mb-4">Ranking Ciudadano</h3>
          <div className="space-y-2">
            {CITIZENS.map((citizen, i) => {
              const lc = LEVEL_CONFIG[citizen.level];
              return (
                <div key={citizen.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${i === 0 ? "text-yellow-800" : i === 1 ? "text-gray-500" : i === 2 ? "text-orange-700" : "text-gray-500"}`} style={{ backgroundColor: i === 0 ? "#FFD700" : i === 1 ? "#E0E0E0" : i === 2 ? "#CD7F32" : "#F5F5F5" }}>{i + 1}</div>
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ backgroundColor: lc.color }}>{citizen.avatar}</div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-semibold text-gray-900 truncate">{citizen.name}</span>
                    <div className="text-xs text-gray-400">{citizen.sector} · {citizen.level}</div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-sm font-bold text-gray-900">{citizen.points.toLocaleString()}</div>
                    <div className="text-xs text-gray-400">pts</div>
                  </div>
                </div>
              );
            })}
            {/* Current user row */}
            {me.points > 0 && (
              <div className="flex items-center gap-3 p-3 rounded-xl border-2 mt-2" style={{ backgroundColor: "rgba(74,222,128,0.12)", borderColor: "#A5D6A7" }}>
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ backgroundColor: lvlCfg.color }}>Tú</div>
                {user?.photoUrl
                  ? <img src={user.photoUrl} alt="" className="w-9 h-9 rounded-full flex-shrink-0" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                  : <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ backgroundColor: lvlCfg.color }}>{me.avatar}</div>}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-semibold text-gray-900 truncate">{me.name}</span>
                    <span className="text-[10px] font-bold text-white px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "#4ADE80" }}>Tú</span>
                  </div>
                  <div className="text-xs text-gray-400">{me.sector} · {me.level}</div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-sm font-bold text-gray-900">{me.points.toLocaleString()}</div>
                  <div className="text-xs text-gray-400">pts</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ==================== EDUCATION PAGE ====================

function EducationPage() {
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState<ArticleCategory | "all">("all");
  const [selected, setSelected] = useState<Article | null>(null);
  const [showSources, setShowSources] = useState(false);
  const cats: (ArticleCategory | "all")[] = ["all", "reciclaje", "residuos", "agua", "contaminacion", "clima"];

  const q = search.toLowerCase();
  const filtered = ARTICLES.filter(a => {
    const matchSearch = !q || a.title.toLowerCase().includes(q) || a.summary.toLowerCase().includes(q)
      || (a.source || "").toLowerCase().includes(q)
      || (a.tags || []).some(t => t.toLowerCase().includes(q));
    const matchCat = catFilter === "all" || a.category === catFilter;
    return matchSearch && matchCat;
  });

  if (selected) {
    const catCfg = CAT_CONFIG[selected.category];
    return (
      <div className="min-h-screen bg-background pb-8">
        <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3 sticky top-14 z-30">
          <button onClick={() => setSelected(null)} className="flex items-center gap-1 text-sm text-gray-600 font-medium hover:text-gray-900">← Volver a artículos</button>
        </div>
        <img src={selected.imageUrl} alt={selected.title} className="w-full h-52 object-cover bg-gray-100" onError={e => { (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1535479086554-4f8020786206?w=800&h=400&fit=crop&q=80"; }} />
        <div className="max-w-2xl mx-auto px-4 py-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-semibold px-3 py-1 rounded-full" style={{ backgroundColor: catCfg.color + "18", color: catCfg.color }}>{catCfg.label}</span>
            <span className="text-xs text-gray-400">{selected.readTime} min de lectura · {selected.date}</span>
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-3 leading-snug">{selected.title}</h1>
          <p className="text-gray-600 text-sm mb-5 leading-relaxed">{selected.summary}</p>
          <div className="rounded-xl p-5 text-sm text-gray-700 leading-relaxed space-y-3" style={{ backgroundColor: "rgba(74,222,128,0.12)" }}>
            {({
              ART001: [
                "El informe IQAir 2026 ubica a Lima entre las 10 ciudades con peor Índice de Calidad del Aire (AQI) de Sudamérica. Las estaciones de monitoreo de Lima Sur, incluyendo la de Santa María de la Tablada en VES, registraron niveles de PM2.5 que oscilan entre 60 y 95 µg/m³ durante agosto, entre 3 y 5 veces el límite diario de 25 µg/m³ recomendado por la OMS.",
                "Los principales factores en VES son el transporte diésel en corredores como la Av. El Sol y la Av. César Vallejo, la quema nocturna informal de residuos en lotes baldíos del sector noreste, y las emisiones de la zona industrial PIVES. SENAMHI advierte que las inversiones térmicas propias del invierno costeño atrapan los contaminantes cerca del suelo.",
                "Puedes reducir tu exposición usando mascarillas N95 en horas pico, ventilando el hogar por las mañanas temprano y consultando el mapa de calidad del aire de SENAMHI antes de hacer actividad física al aire libre.",
                "Desde el punto de vista comunitario, la acción más impactante es reportar episodios de quema a través de EcoAlert VES y llamar al 116 (Bomberos) cuando detectes humos tóxicos. Cada denuncia fundamentada activa a la municipalidad y al OEFA para fiscalizar y sancionar al responsable dentro de las 48 horas.",
              ],
              ART002: [
                "A partir de agosto 2026, el MINAM actualizó el código de colores para la separación de residuos: bolsa verde para orgánicos (cáscaras, restos de comida), azul para papel y cartón, amarillo para plásticos y metales, negro para residuos no reciclables, rojo para materiales peligrosos (pilas, medicamentos vencidos) y marrón para aparatos eléctricos y electrónicos (RAEE).",
                "En VES, los camiones de recolección diferenciada pasan los martes y viernes por los sectores 1–4, y los lunes y jueves por los sectores 5–7 y PPAO. Para el RAEE, la Municipalidad habilitó puntos de acopio permanentes en la Plaza Mayor y en la Casa de la Juventud.",
                "Separar correctamente tus residuos en la fuente permite que el 30% sea reciclado y vendido a empresas recuperadoras, generando ingresos para el programa municipal y reduciendo los residuos que llegan al relleno sanitario de Portillo Grande.",
                "Un truco práctico: pega en tu cocina una tarjeta laminada con los 6 colores y 3 ejemplos de cada categoría. Familias que hacen esto segregan correctamente el 90% de sus residuos desde la primera semana, según datos del programa piloto del Sector 5.",
              ],
              ART003: [
                "SEDAPAL proyecta para el verano 2026-2027 un déficit de suministro de hasta el 20% en los distritos del cono sur de Lima, incluyendo VES. Con las temperaturas récord registradas en agosto (29.1°C el día 25), el consumo hídrico doméstico sube un 35-40% respecto al invierno, agravando la presión sobre las redes.",
                "Diez hábitos para ahorrar agua: cierra el caño mientras te enjabonas (ahorras 12 l/baño), dúchate en menos de 5 minutos, riega las plantas al amanecer, reutiliza el agua del lavado de verduras, repara grifos con goteo (pueden desperdiciar 30 l/día), usa lavadora y lavavajillas con carga completa, no uses la manguera para limpiar veredas, instala un reductor de caudal en grifos, almacena agua en cisternas limpias los domingos (días de corte programado), y reporta fugas en la vía pública al 0800-1-0900.",
                "Un hogar de 4 personas que aplica estas medidas puede reducir su consumo de 120 a 84 litros por persona/día, ahorrando cerca de 130 soles al año en la factura de agua.",
                "Recuerda que el agua subterránea en VES no es apta para consumo humano sin tratamiento: los pozos de la zona presentan niveles de arsénico y coliformes por encima de los estándares ECA-Agua. Siempre usa agua de SEDAPAL para beber y cocinar, y filtra si es posible.",
              ],
              ART004: [
                "El OEFA inició en agosto 2026 operativos de fiscalización sorpresa en 14 empresas del Parque Industrial de Villa El Salvador (PIVES). Las denuncias ciudadanas documentadas en el sistema municipal incluyen efluentes con coloración oscura y olor químico en las acequias del sector, episodios de emisiones nocturnas y vertidos de aceite usado en alcantarillas.",
                "Las infracciones más frecuentes detectadas son: disposición inadecuada de efluentes industriales (art. 13 del D.S. 003-2010-MINAM), emisiones que superan los ECA para aire en calidad de PM10 y SO₂, y almacenamiento deficiente de residuos peligrosos. Las multas pueden alcanzar 600 UIT (aproximadamente 3.18 millones de soles).",
                "Si detectas una descarga industrial sospechosa, fotografía la hora, ubicación y apariencia del efluente y repórtalo en EcoAlert VES o directamente a OEFA mediante su plataforma de denuncias en línea (oefa.gob.pe/denuncias). Las denuncias ciudadanas son la principal fuente de alertas tempranas del organismo fiscalizador.",
                "Para que tu denuncia sea procesada más rápido, incluye: hora exacta, nombre o número de empresa si es visible, descripción del color y olor del efluente, y si hay afectación a vecinos o animales. Denuncias con evidencia fotográfica o video tienen una tasa de procesamiento 3 veces mayor que las sin evidencia.",
              ],
              ART005: [
                "El estudio publicado por el IMARPE en julio 2026 encontró microplásticos en el 95% de las muestras de agua de las playas de Lurín, Villa María del Triunfo y Punta Hermosa. Las concentraciones más altas se encontraron en zonas con desembocadura de acequias provenientes de VES y Villa María, donde los residuos plásticos ingresan al océano durante las lluvias.",
                "Los tipos más comunes son fibras de ropa sintética (liberadas en cada lavado de máquina), fragmentos de botellas PET, microperlas de cosméticos y películas de embalaje. Estos microplásticos son ingeridos por peces y mariscos de consumo humano, representando un riesgo sanitario emergente.",
                "Para reducir tu aporte: usa bolsas de tela, evita envases de un solo uso, coloca una malla en el desagüe de la lavadora para atrapar fibras sintéticas, y nunca arroje basura en acequias o canales. Reporta puntos de vertido en EcoAlert VES.",
                "Dato clave: el 80% de los plásticos que llegan al océano provienen de tierra firme, no de embarcaciones. Cada plástico que evitas en VES protege directamente las playas del sur de Lima. Si participas en la próxima feria ambiental del 27 de setiembre, el stand del IMARPE ofrece demostraciones de filtros para lavadora que atrapan microfibras.",
              ],
              ART006: [
                "El programa piloto de compostaje comunitario del Sector 5 de VES lleva 8 meses en funcionamiento y ha logrado reducir en un 60% los residuos orgánicos que van al camión municipal. El sistema funciona con 8 composters comunitarios ubicados en áreas verdes de las manzanas, gestionados por vecinos líderes capacitados por la Municipalidad.",
                "El proceso es simple: cada vecino separa sus restos de frutas, verduras y restos de jardín en una bolsa verde. Cada dos días, los deposita en el composter de su manzana. Voluntarios mezclan con hojas secas, humedecen y voltean la mezcla semanalmente. En 60–90 días, el abono resultante se usa en las áreas verdes del sector.",
                "Para replicar el sistema en tu manzana, contacta a la Gerencia de Medio Ambiente de la Municipalidad de VES (teléfono 251-0170) o escríbeles por su Facebook oficial. El municipio provee los composters y la capacitación de forma gratuita.",
                "El abono producido tiene alto contenido de nitrógeno y potasio. En pruebas piloto con agricultores urbanos de VES, las plantas fertilizadas con compost del programa crecieron un 35% más rápido que las tratadas con fertilizantes sintéticos, con menor costo y sin residuos químicos en el suelo.",
              ],
              ART007: [
                "El 25 de agosto de 2026, SENAMHI registró 29.1°C en la estación de Villa El Salvador, la temperatura más alta para un mes de agosto en 35 años de registros meteorológicos en Lima Sur. Esta anomalía térmica está asociada al adelgazamiento de la nubosidad estratiforme característica del invierno limeño, fenómeno vinculado al calentamiento del Pacífico Sur.",
                "Las consecuencias ambientales son múltiples: mayor evaporación de contaminantes acuáticos en acequias y canales, aumento de olores por descomposición acelerada de residuos, mayor incidencia de incendios en lotes con vegetación seca, y agravamiento de la isla de calor urbana en zonas sin áreas verdes como el sector noreste de VES.",
                "Frente a este escenario, la arborización es la intervención más efectiva a escala de barrio: un árbol adulto reduce la temperatura local hasta 4°C por evapotranspiración. Puedes solicitar plantación de árboles en tu cuadra a través de SERPAR Lima o participar en las jornadas de arborización de la Municipalidad de VES.",
                "Científicos del SENAMHI predicen que, de continuar la tendencia actual, VES podría registrar temperaturas de hasta 32°C en agosto para 2035. Los sectores más vulnerables son los que tienen menos del 5% de cobertura vegetal, como el sector noreste y las zonas cercanas al PIVES. Inscríbete a la campaña de plantación del 20 de setiembre para contribuir directamente.",
              ],
              ART008: [
                "Los residuos de aparatos eléctricos y electrónicos (RAEE) contienen plomo, mercurio, cadmio y arsénico. Cuando se desechan junto a la basura común y llegan al relleno sanitario, estos metales pesados lixivian al suelo y aguas subterráneas. Lima genera unas 60,000 toneladas de RAEE al año, de las cuales menos del 5% recibe tratamiento formal.",
                "Directorio de puntos de acopio certificados en VES y zonas cercanas (agosto 2026): Plaza Mayor de VES (sábados 9 am–1 pm), Casa de la Juventud (martes y jueves), Parque Industrial VES — empresa EcoRaee (previa cita: 999-123-456), centros Coolbox y Movistar en Chorrillos y San Juan de Miraflores (aceptan celulares y tabletas). También puedes usar la app ReciclaRed para pedir recojo a domicilio.",
                "Los artículos que puedes entregar: celulares, laptops, tablets, televisores, cargadores, pilas y baterías, focos ahorradores, electrodomésticos pequeños (licuadoras, planchas, secadoras de pelo). La entrega es gratuita y algunas empresas ofrecen descuentos en productos nuevos a cambio.",
                "Un celular en desuso promedio contiene 0.034 gramos de oro, 0.35 gramos de plata, cobre, paladio y cobalto. Si los 500,000 habitantes de VES entregaran sus celulares viejos, se recuperarían metales preciosos por un valor estimado de 8 millones de soles, generando empleo local y evitando la minería de nuevas materias primas.",
              ],
            } as Record<string, string[]>)[selected.id]?.map((p, i) => <p key={i}>{p}</p>) || (
              <>
                <p>En Villa El Salvador, como en muchos distritos de Lima, la gestión de residuos sólidos y la calidad ambiental son desafíos críticos. Con más de 500,000 habitantes, la producción diaria de residuos supera las 380 toneladas y el índice de calidad del aire supera frecuentemente los límites recomendados por la OMS.</p>
                <p>El sistema de segregación en la fuente impulsado por la Municipalidad de VES y el MINAM busca que el 60% de residuos orgánicos sea compostado y el 30% de materiales reciclables sea recuperado antes de llegar al relleno sanitario de Portillo Grande.</p>
                <p>Puedes contribuir activamente reportando incidentes en EcoAlert VES, participando en las jornadas de limpieza y difundiendo información verificada con tus vecinos.</p>
              </>
            )}
          </div>
          <div className="flex items-center gap-3 mt-4 text-xs text-gray-400">
            <div className="flex items-center gap-1"><Eye className="w-3.5 h-3.5" />{selected.views.toLocaleString()} vistas</div>
            <div className="flex items-center gap-1"><Star className="w-3.5 h-3.5" />{Math.floor(selected.views * 0.04)} valoraciones</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-8">
      <div className="text-white px-4 pb-5 pt-6" style={{ background: "linear-gradient(135deg, #1565C0, #00D4FF)" }}>
        <h1 className="text-2xl font-bold mb-1">Educación Ambiental</h1>
        <p className="text-white/70 text-sm mb-1">Artículos actualizados cada semana · VES, Lima, Perú</p>
        <p className="text-white/50 text-xs mb-4">Semana del 25 al 31 de agosto, 2026 · Fuentes verificadas</p>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por título, fuente o etiqueta..." className="w-full bg-white text-gray-800 pl-9 pr-4 py-2.5 rounded-xl text-sm focus:outline-none" />
          </div>
          <button onClick={() => setShowSources(!showSources)} className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors flex-shrink-0" style={showSources ? { backgroundColor: "white", color: "#00D4FF" } : { backgroundColor: "rgba(255,255,255,0.2)", color: "white" }}>
            🔗 Fuentes
          </button>
        </div>
      </div>
      {showSources && (
        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} className="bg-white border-b border-gray-100 overflow-hidden">
          <div className="max-w-2xl mx-auto px-4 py-5">
            <h3 className="font-bold text-gray-900 mb-1">Fuentes confiables</h3>
            <p className="text-xs text-gray-400 mb-4">Todo el contenido de EcoAlert VES proviene de estas fuentes oficiales y medios verificados.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {TRUSTED_SOURCES.map(src => (
                <a key={src.name} href={src.url} target="_blank" rel="noopener noreferrer" className="flex items-start gap-3 p-3 rounded-xl border border-gray-100 hover:border-gray-300 hover:shadow-sm transition-all">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-xl" style={{ backgroundColor: src.color + "18" }}>{src.logo}</div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5"><span className="text-sm font-bold text-gray-900">{src.name}</span><span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: src.color + "18", color: src.color }}>Verificado</span></div>
                    <p className="text-[11px] text-gray-500 leading-snug mt-0.5 line-clamp-2">{src.desc}</p>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </motion.div>
      )}
      <div className="max-w-2xl mx-auto px-4 py-4">
        <div className="flex gap-2 overflow-x-auto pb-2 mb-4" style={{ scrollbarWidth: "none" }}>
          {cats.map(cat => (
            <button key={cat} onClick={() => setCatFilter(cat)} className="flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-semibold transition-colors" style={catFilter === cat ? { backgroundColor: "#00D4FF", color: "white" } : { backgroundColor: "white", color: "#555", border: "1px solid #E0E0E0" }}>
              {cat === "all" ? "Todos" : CAT_CONFIG[cat].label}
            </button>
          ))}
        </div>
        <div className="space-y-4">
          {filtered.map((article, idx) => {
            const catCfg = CAT_CONFIG[article.category];
            return (
              <motion.div key={article.id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }} whileHover={{ y: -2 }} onClick={() => setSelected(article)} className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 cursor-pointer flex flex-col sm:flex-row">
                <img src={article.imageUrl} alt={article.title} className="w-full sm:w-36 h-40 sm:h-auto object-cover bg-gray-100 flex-shrink-0" onError={e => { (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1535479086554-4f8020786206?w=800&h=400&fit=crop&q=80"; }} />
                <div className="p-4 flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: catCfg.color + "18", color: catCfg.color }}>{catCfg.label}</span>
                    <span className="text-xs text-gray-400">{article.readTime} min</span>
                  </div>
                  <h3 className="font-semibold text-gray-900 text-sm mb-1.5 leading-snug">{article.title}</h3>
                  <p className="text-xs text-gray-500 line-clamp-2 mb-3">{article.summary}</p>
                  <div className="flex items-center gap-3 text-xs text-gray-400">
                    <div className="flex items-center gap-1"><Eye className="w-3 h-3" />{article.views.toLocaleString()}</div>
                    {article.source && <span className="font-medium text-gray-500 truncate">{article.source}</span>}
                    <span className="flex-shrink-0">{article.date}</span>
                  </div>
                </div>
              </motion.div>
            );
          })}
          {filtered.length === 0 && <div className="text-center py-14 text-gray-400"><BookOpen className="w-12 h-12 mx-auto mb-3 opacity-30" /><p className="text-sm">No se encontraron artículos</p></div>}
        </div>
      </div>
    </div>
  );
}

// ==================== ADMIN PAGE ====================

function AdminPage({ liveReports = [] }: { liveReports?: SubmittedReport[] }) {
  const [staticReports, setStaticReports] = useState(REPORTS.map(r => ({ ...r })));
  const [liveStatuses, setLiveStatuses] = useState<Record<string, ReportStatus>>({});
  const [tab, setTab] = useState<"overview" | "reports" | "charts">("overview");
  const [statusFilter, setStatusFilter] = useState<ReportStatus | "all">("all");
  const [chartData, setChartData] = useState(MONTHLY_DATA.map(d => ({ ...d })));
  const [typeDist, setTypeDist] = useState(TYPE_DIST.map(d => ({ ...d })));
  const [sectorData, setSectorData] = useState(SECTOR_DATA.map(d => ({ ...d })));
  const [lastUpdate, setLastUpdate] = useState(new Date());

  // Simulate live chart updates
  useEffect(() => {
    const timer = setInterval(() => {
      setChartData(prev => {
        const next = prev.map(d => ({ ...d }));
        const last = next[next.length - 1];
        last.reportes = Math.max(last.reportes + Math.floor(Math.random() * 3 - 1), 0);
        last.resueltos = Math.min(last.reportes, Math.max(last.resueltos + Math.floor(Math.random() * 2), 0));
        // Occasionally add a new month data point
        if (next.length < 12 && Math.random() < 0.1) {
          const MONTHS = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
          const lastMesIdx = MONTHS.indexOf(last.mes);
          const nextMes = MONTHS[(lastMesIdx + 1) % 12];
          if (!next.find(d => d.mes === nextMes)) {
            next.push({ mes: nextMes, reportes: Math.floor(Math.random() * 20) + 30, resueltos: Math.floor(Math.random() * 15) + 20 });
          }
        }
        return next;
      });
      setTypeDist(prev => prev.map(d => ({
        ...d,
        value: Math.max(1, d.value + Math.floor(Math.random() * 3 - 1)),
      })));
      setSectorData(prev => prev.map(d => ({
        ...d,
        reportes: Math.max(1, (d as any).reportes + Math.floor(Math.random() * 3 - 1)),
      })));
      setLastUpdate(new Date());
    }, 8000);
    return () => clearInterval(timer);
  }, []);

  // Convert live Firestore reports to admin Report shape
  const liveAsAdmin: Report[] = liveReports.map(r => ({
    id: r.id, type: r.type,
    severity: (() => { const sev = ["quema", "aguas"].includes(r.type) ? "alto" : ["escombros", "aire"].includes(r.type) ? "medio" : "bajo"; return sev as Severity; })(),
    status: liveStatuses[r.id] || "pendiente",
    description: r.description, location: r.location,
    sector: "Villa El Salvador", date: r.date,
    user: r.userName, votes: r.upvotes,
    imageUrl: r.imageUrl || "https://images.unsplash.com/photo-1662534264036-7bfa0d35de9c?w=400&h=250&fit=crop&q=80",
    lat: r.lat || -12.213, lng: r.lng || -76.924,
  }));

  const allReports = [...liveAsAdmin, ...staticReports];

  const changeStatus = (id: string, status: ReportStatus) => {
    if (liveReports.some(r => r.id === id)) {
      setLiveStatuses(prev => ({ ...prev, [id]: status }));
      if (db) updateDoc(doc(db, "webReports", id), { status }).catch(() => {});
    } else {
      setStaticReports(prev => prev.map(r => r.id === id ? { ...r, status } : r));
    }
  };

  const counts = { total: allReports.length, pending: allReports.filter(r => r.status === "pendiente").length, inProgress: allReports.filter(r => r.status === "proceso").length, resolved: allReports.filter(r => r.status === "resuelto").length };
  const filtered = statusFilter === "all" ? allReports : allReports.filter(r => r.status === statusFilter);
  const reports = allReports;

  return (
    <div className="min-h-screen bg-background pb-8">
      <div className="text-white px-4 py-6" style={{ backgroundColor: "#1A237E" }}>
        <h1 className="text-2xl font-bold">Panel Administrativo</h1>
        <p className="text-white/70 text-sm">Gestión de reportes ambientales · EcoAlert VES</p>
      </div>
      <div className="bg-white border-b border-gray-100 sticky top-14 z-30">
        <div className="max-w-7xl mx-auto px-4 flex">
          {[{ k: "overview", l: "Resumen" }, { k: "reports", l: "Reportes" }, { k: "charts", l: "Gráficos" }].map(t => (
            <button key={t.k} onClick={() => setTab(t.k as typeof tab)} className={`px-5 py-3.5 text-sm font-semibold border-b-2 transition-colors ${tab === t.k ? "border-[#1A237E] text-[#1A237E]" : "border-transparent text-gray-500 hover:text-gray-700"}`}>{t.l}</button>
          ))}
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-4 py-5">
        {tab === "overview" && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { value: counts.total, label: "Total reportes", bg: "white", c: "#1A237E", b: "#E8EAF6" },
                { value: counts.pending, label: "Pendientes", bg: "#FFEBEE", c: "#D32F2F", b: "#FFEBEE" },
                { value: counts.inProgress, label: "En proceso", bg: "#FFF3E0", c: "#FBBF24", b: "#FFF3E0" },
                { value: counts.resolved, label: "Resueltos", bg: "rgba(74,222,128,0.12)", c: "#4ADE80", b: "rgba(74,222,128,0.12)" },
              ].map(s => (
                <div key={s.label} className="rounded-2xl p-4 text-center shadow-sm border" style={{ backgroundColor: s.bg, borderColor: s.b }}>
                  <div className="text-3xl font-bold" style={{ color: s.c }}>{s.value}</div>
                  <div className="text-xs mt-0.5" style={{ color: s.c + "CC" }}>{s.label}</div>
                </div>
              ))}
            </div>
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <h3 className="font-bold text-gray-900 mb-4">Últimos reportes</h3>
              <div className="space-y-3">
                {reports.slice(0, 5).map(report => (
                  <div key={report.id} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50">
                    <img src={report.imageUrl} alt="" className="w-12 h-12 rounded-lg object-cover bg-gray-100 flex-shrink-0" onError={e => { (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1662534264036-7bfa0d35de9c?w=400&h=250&fit=crop&q=80"; }} />
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-mono text-gray-400">{report.id}</span>
                      <div className="text-sm text-gray-700 truncate">{report.location}</div>
                      <div className="text-xs text-gray-400">{report.sector} · {report.user}</div>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0"><SeverityBadge severity={report.severity} /><StatusBadge status={report.status} /></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        {tab === "reports" && (
          <div className="space-y-4">
            <div className="flex gap-2 flex-wrap">
              {(["all", "pendiente", "proceso", "resuelto"] as const).map(s => (
                <button key={s} onClick={() => setStatusFilter(s)} className="px-4 py-1.5 rounded-full text-xs font-semibold transition-colors" style={statusFilter === s ? { backgroundColor: "#1A237E", color: "white" } : { backgroundColor: "white", color: "#555", border: "1px solid #E0E0E0" }}>
                  {s === "all" ? "Todos" : STATUS_CONFIG[s].label}{s !== "all" && <span className="ml-1.5 opacity-60">({reports.filter(r => r.status === s).length})</span>}
                </button>
              ))}
            </div>
            <div className="space-y-3">
              {filtered.map(report => (
                <div key={report.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                  <div className="flex items-start gap-3">
                    <img src={report.imageUrl} alt="" className="w-16 h-16 rounded-xl object-cover bg-gray-100 flex-shrink-0" onError={e => { (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1662534264036-7bfa0d35de9c?w=400&h=250&fit=crop&q=80"; }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between mb-1"><span className="text-xs font-mono text-gray-400">{report.id}</span><span className="text-xs text-gray-400">{report.date}</span></div>
                      <div className="flex flex-wrap gap-1.5 mb-2"><TypeBadge type={report.type} /><SeverityBadge severity={report.severity} /></div>
                      <p className="text-xs text-gray-600 line-clamp-2 mb-1.5">{report.description}</p>
                      <div className="text-xs text-gray-400 mb-3">{report.location} · {report.user}</div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-medium text-gray-500">Estado:</span>
                        {(["pendiente", "proceso", "resuelto"] as ReportStatus[]).map(s => (
                          <button key={s} onClick={() => changeStatus(report.id, s)} className="px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors" style={report.status === s ? { backgroundColor: STATUS_CONFIG[s].bg, color: STATUS_CONFIG[s].color } : { backgroundColor: "#F5F5F5", color: "#777" }}>
                            {STATUS_CONFIG[s].label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {tab === "charts" && (
          <div className="space-y-5">
            <div className="flex items-center gap-2 px-1">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs text-gray-400">Actualizado: {lastUpdate.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
              <span className="text-xs text-gray-300">· simulación en vivo</span>
            </div>
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <h3 className="font-bold text-gray-900 mb-0.5">Tendencia mensual 2026</h3>
              <p className="text-xs text-gray-400 mb-4">Reportes enviados vs. casos resueltos por mes</p>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" />
                  <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Area type="monotone" dataKey="reportes" name="Reportes" stroke="#00D4FF" fill="#00D4FF" fillOpacity={0.12} strokeWidth={2} />
                  <Area type="monotone" dataKey="resueltos" name="Resueltos" stroke="#4ADE80" fill="#4ADE80" fillOpacity={0.12} strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <h3 className="font-bold text-gray-900 mb-0.5">Tipos de contaminación</h3>
              <p className="text-xs text-gray-400 mb-4">Distribución porcentual de reportes · actualizado en vivo</p>
              <div className="flex items-center gap-4">
                <ResponsiveContainer width="55%" height={170}>
                  <PieChart>
                    <Pie data={typeDist} dataKey="value" cx="50%" cy="50%" outerRadius={75} innerRadius={42}>
                      {typeDist.map((e, i) => <Cell key={`cell-${i}`} fill={e.color} />)}
                    </Pie>
                    <Tooltip formatter={(v) => `${v}%`} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-2">
                  {typeDist.map(item => {
                    const total = typeDist.reduce((s, d) => s + d.value, 0);
                    const pct = Math.round((item.value / total) * 100);
                    return (
                      <div key={item.name} className="flex items-center gap-2 text-xs">
                        <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: item.color }} />
                        <span className="flex-1 text-gray-700">{item.name}</span>
                        <span className="font-bold text-gray-900">{pct}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <h3 className="font-bold text-gray-900 mb-0.5">Reportes por sector</h3>
              <p className="text-xs text-gray-400 mb-4">Distribución geográfica en Villa El Salvador</p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={sectorData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis dataKey="sector" type="category" tick={{ fontSize: 10 }} width={62} />
                  <Tooltip />
                  <Bar dataKey="reportes" name="Reportes" fill="#00D4FF" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ==================== COMMUNITY PAGE ====================

interface ReportComment {
  id: string;
  text: string;
  userName: string;
  userPhoto: string | null;
  createdAt: string;
}

function relativeTime(dateStr: string): string {
  try {
    const now = Date.now();
    const ts = new Date(dateStr).getTime();
    const diff = now - ts;
    if (diff < 60000) return "ahora";
    if (diff < 3600000) return `${Math.floor(diff / 60000)} min`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} h`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)} d`;
    return new Date(dateStr).toLocaleDateString("es-PE", { day: "2-digit", month: "short" });
  } catch { return dateStr; }
}

function CommentSection({ reportId, currentUser }: { reportId: string; currentUser: GoogleUser | null }) {
  const [comments, setComments] = useState<ReportComment[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!db) return;
    const q = query(collection(db, "webReports", reportId, "comments"), orderBy("createdAt", "asc"), limit(50));
    const unsub = onSnapshot(q, snap => {
      setComments(snap.docs.map(d => {
        const data = d.data();
        const ts = data.createdAt?.toDate?.() ?? new Date();
        return {
          id: d.id,
          text: data.text,
          userName: data.userName || "Anónimo",
          userPhoto: data.userPhoto || null,
          createdAt: ts.toLocaleString("es-PE", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }),
        };
      }));
    }, () => {});
    return unsub;
  }, [reportId]);

  const sendComment = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    const name = currentUser?.name || "Ciudadano anónimo";
    const photo = currentUser?.photoUrl || null;
    const commentText = text.trim();
    setText("");
    try {
      if (db) {
        await addDoc(collection(db, "webReports", reportId, "comments"), {
          text: commentText, userName: name, userPhoto: photo, createdAt: serverTimestamp(),
          userId: currentUser?.uid || null,
        });
      } else {
        setComments(prev => [...prev, { id: Date.now().toString(), text: commentText, userName: name, userPhoto: photo, createdAt: new Date().toISOString() }]);
      }
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    } catch {} finally { setSending(false); }
  };

  const deleteComment = async (commentId: string) => {
    if (!db || deleting) return;
    setDeleting(commentId);
    try {
      await deleteDoc(doc(db, "webReports", reportId, "comments", commentId));
    } catch {} finally { setDeleting(null); }
  };

  return (
    <div className="border-t border-gray-100 pt-4 mt-2">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-bold text-gray-600 flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5" style={{ color: "#4ADE80" }} />
          Comentarios · {comments.length}
        </p>
        {!currentUser && (
          <span className="text-[10px] text-gray-400 italic">Inicia sesión para comentar</span>
        )}
      </div>
      {comments.length > 0 && (
        <div className="space-y-3 mb-4 max-h-72 overflow-y-auto pr-1" style={{ scrollbarWidth: "thin" }}>
          {comments.map(c => {
            const isOwn = currentUser?.name === c.userName || (currentUser?.uid && (c as any).userId === currentUser.uid);
            return (
              <motion.div key={c.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex items-start gap-2.5 group">
                {c.userPhoto
                  ? <img src={c.userPhoto} alt="" className="w-7 h-7 rounded-full border border-gray-100 flex-shrink-0 mt-0.5" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                  : <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-xs font-bold text-white flex-shrink-0" style={{ background: "linear-gradient(135deg, #4ADE80, #00D4FF)" }}>{(c.userName[0] || "?").toUpperCase()}</div>
                }
                <div className="flex-1 bg-gray-50 rounded-2xl rounded-tl-sm px-3 py-2.5">
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-gray-800">{c.userName}</span>
                      {isOwn && <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "rgba(74,222,128,0.12)", color: "#4ADE80" }}>Tú</span>}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-gray-400">{relativeTime(c.createdAt)}</span>
                      {isOwn && db && (
                        <button onClick={() => deleteComment(c.id)} disabled={deleting === c.id} className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-300 hover:text-red-400 disabled:opacity-30">
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-gray-700 leading-relaxed">{c.text}</p>
                </div>
              </motion.div>
            );
          })}
          <div ref={bottomRef} />
        </div>
      )}
      {comments.length === 0 && (
        <p className="text-xs text-gray-400 text-center py-3 mb-3">Sé el primero en comentar este reporte</p>
      )}
      <div className="flex items-center gap-2">
        {currentUser?.photoUrl
          ? <img src={currentUser.photoUrl} alt="" className="w-8 h-8 rounded-full border border-gray-100 flex-shrink-0" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
          : <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold text-white" style={{ background: currentUser ? "linear-gradient(135deg, #4ADE80, #00D4FF)" : "#D1D5DB" }}>{currentUser ? currentUser.name[0].toUpperCase() : "?"}</div>
        }
        <div className="flex-1 flex items-center gap-2 bg-gray-100 rounded-2xl px-3 py-2">
          <input
            ref={inputRef} value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendComment()}
            placeholder={currentUser ? "Escribe un comentario…" : "Inicia sesión para comentar"}
            disabled={!currentUser}
            className="flex-1 bg-transparent text-xs focus:outline-none disabled:opacity-50 text-gray-800"
          />
          <button onClick={sendComment} disabled={!text.trim() || !currentUser || sending} className="flex items-center justify-center rounded-xl transition-all disabled:opacity-30" style={{ color: "#4ADE80" }}>
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function CommunityPage({ reports, setPage, currentUser }: { reports: SubmittedReport[]; setPage: (p: Page) => void; currentUser: GoogleUser | null }) {
  const [upvoted, setUpvoted] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem("eco_upvoted") || "[]")); } catch { return new Set(); }
  });
  const [localUpvotes, setLocalUpvotes] = useState<Record<string, number>>({});
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());

  const toggleUpvote = (id: string) => {
    const isUpvoted = upvoted.has(id);
    const delta = isUpvoted ? -1 : 1;
    setUpvoted(prev => {
      const next = new Set(prev);
      isUpvoted ? next.delete(id) : next.add(id);
      try { localStorage.setItem("eco_upvoted", JSON.stringify([...next])); } catch {}
      return next;
    });
    setLocalUpvotes(u => ({ ...u, [id]: (u[id] ?? 0) + delta }));
    if (db) updateDoc(doc(db, "webReports", id), { upvotes: increment(delta) }).catch(() => {});
  };

  const toggleComments = (id: string) => setExpandedComments(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  return (
    <div className="min-h-screen bg-background pb-8">
      <div className="text-white px-4 pt-6 pb-5" style={{ background: "linear-gradient(135deg, #4ADE80 0%, #1565C0 100%)" }}>
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-3 mb-1"><Users className="w-6 h-6 opacity-80" /><h1 className="text-2xl font-bold">Comunidad VES</h1></div>
          <p className="text-white/70 text-sm">Reportes compartidos por la comunidad</p>
          <div className="flex gap-4 mt-4">
            <div className="text-center"><div className="text-2xl font-bold">{reports.length}</div><div className="text-white/60 text-xs">Publicados</div></div>
            <div className="w-px bg-white/20" />
            <div className="text-center"><div className="text-2xl font-bold">{reports.reduce((s, r) => s + r.upvotes + (localUpvotes[r.id] ?? 0), 0)}</div><div className="text-white/60 text-xs">Apoyos</div></div>
            <div className="w-px bg-white/20" />
            <div className="text-center"><div className="text-2xl font-bold">{new Set(reports.map(r => r.type)).size}</div><div className="text-white/60 text-xs">Tipos</div></div>
          </div>
        </div>
      </div>
      <div className="max-w-2xl mx-auto px-4 py-5 space-y-4">
        {reports.length === 0 ? (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-2xl p-10 text-center shadow-sm border border-gray-100">
            <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: "rgba(74,222,128,0.12)" }}><Users className="w-10 h-10" style={{ color: "#4ADE80" }} /></div>
            <h2 className="text-lg font-bold text-gray-800 mb-2">Sé el primero en reportar</h2>
            <p className="text-sm text-gray-400 mb-6">Cuando confirmes un reporte, aparecerá aquí para que toda la comunidad lo vea.</p>
            <button onClick={() => setPage("report")} className="px-6 py-3 rounded-xl font-semibold text-white text-sm shadow-md" style={{ backgroundColor: "#4ADE80" }}>+ Hacer un reporte</button>
          </motion.div>
        ) : (
          reports.map((report, idx) => {
            const tc = TYPE_CONFIG[report.type];
            const votes = report.upvotes + (localUpvotes[report.id] ?? 0);
            const hasUpvoted = upvoted.has(report.id);
            const commentsOpen = expandedComments.has(report.id);
            return (
              <motion.div key={report.id} initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.06 }} className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100">
                {report.imageUrl ? (
                  <div className="relative">
                    <img src={report.imageUrl} alt="Foto del reporte" className="w-full object-cover" style={{ maxHeight: 280, minHeight: 180 }} onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                    <div className="absolute top-3 left-3 flex gap-2">
                      <span className="text-[11px] font-bold px-2.5 py-1 rounded-full shadow-sm" style={{ backgroundColor: tc.bg, color: tc.color }}>{tc.label}</span>
                      <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-green-600 text-white shadow-sm">Reporte ciudadano</span>
                    </div>
                  </div>
                ) : (
                  <div className="w-full flex items-center justify-center" style={{ height: 120, backgroundColor: tc.bg }}><span className="text-4xl opacity-30">📷</span></div>
                )}
                <div className="p-4">
                  <p className="text-gray-800 text-sm leading-relaxed mb-4">{report.description}</p>
                  <div className="rounded-xl p-3.5 mb-4" style={{ backgroundColor: "#E3F2FD" }}>
                    <div className="flex items-start gap-2"><MapPin className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "#1565C0" }} /><div><p className="text-sm font-semibold text-gray-800 leading-tight">{report.location}</p>{report.lat !== null && report.lng !== null && <p className="text-xs mt-0.5" style={{ color: "#1565C0", fontFamily: "monospace" }}>{Math.abs(report.lat).toFixed(6)}°S, {Math.abs(report.lng).toFixed(6)}°W</p>}</div></div>
                  </div>
                  {report.lat !== null && report.lng !== null && (
                    <a href={`https://www.openstreetmap.org/?mlat=${report.lat}&mlon=${report.lng}#map=17/${report.lat}/${report.lng}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs font-semibold mb-4 hover:underline" style={{ color: "#00D4FF" }}><Eye className="w-3.5 h-3.5" />Ver en mapa externo</a>
                  )}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      {report.userPhoto ? <img src={report.userPhoto} alt="" className="w-6 h-6 rounded-full border border-gray-200 flex-shrink-0" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} /> : <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0"><Users className="w-3.5 h-3.5 text-gray-400" /></div>}
                      <div className="text-xs text-gray-400"><span className="font-medium text-gray-600">{report.userName}</span> · {report.date} {report.time}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => toggleComments(report.id)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all" style={commentsOpen ? { backgroundColor: "#E3F2FD", color: "#1565C0" } : { backgroundColor: "#F5F5F5", color: "#777" }}>
                        💬 {commentsOpen ? "Ocultar" : "Comentar"}
                      </button>
                      <button onClick={() => toggleUpvote(report.id)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all" style={hasUpvoted ? { backgroundColor: "rgba(74,222,128,0.12)", color: "#4ADE80" } : { backgroundColor: "#F5F5F5", color: "#777" }}>
                        <Star className="w-3.5 h-3.5" fill={hasUpvoted ? "#4ADE80" : "none"} />{votes}
                      </button>
                    </div>
                  </div>
                  {commentsOpen && <CommentSection reportId={report.id} currentUser={currentUser} />}
                </div>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ==================== FIREBASE HELPERS ====================

async function compressImage(dataUrl: string, maxPx = 480): Promise<string> {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale); canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.6));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

function FirebaseSetupScreen() {
  return (
    <div className="fixed inset-0 z-[999] bg-white flex items-center justify-center p-6">
      <div className="max-w-md w-full">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6" style={{ backgroundColor: "#FFF3E0" }}><Settings className="w-8 h-8" style={{ color: "#FBBF24" }} /></div>
        <h2 className="text-2xl font-bold text-gray-900 text-center mb-3">Configura Firebase</h2>
        <p className="text-sm text-gray-500 text-center mb-6">Para activar el inicio de sesión real con Google y reportes en tiempo real, necesitas un proyecto Firebase con el dominio de esta app autorizado.</p>
        <div className="bg-gray-50 rounded-xl p-4 mb-5 space-y-3 text-sm">
          <p className="font-semibold text-gray-700">Pasos:</p>
          <ol className="list-decimal list-inside space-y-1.5 text-gray-600">
            <li>Crea un proyecto en <span className="font-mono text-xs bg-gray-200 px-1 rounded">console.firebase.google.com</span></li>
            <li>Authentication → Sign-in method → habilita <b>Google</b></li>
            <li>Authentication → Authorized domains → agrega <b>este dominio</b></li>
            <li>Firestore Database → Crear base de datos</li>
            <li>Configuración → Web app → copia la config a variables de entorno</li>
          </ol>
        </div>
        <div className="bg-gray-900 rounded-xl p-4 mb-5 text-xs font-mono text-green-400 space-y-1">
          <p className="text-gray-400">{"// Firestore Rules (desarrollo)"}</p>
          <p>{"rules_version = '2';"}</p>
          <p>{"service cloud.firestore {"}</p>
          <p>{"  match /databases/{db}/documents {"}</p>
          <p>{"    match /{doc=**} { allow read, write: if true; }"}</p>
          <p>{"  }"}</p>
          <p>{"}"}</p>
        </div>
        <p className="text-xs text-gray-400 text-center">Las variables <span className="font-mono">VITE_FIREBASE_*</span> ya están listas — solo ingresa los valores de tu proyecto.</p>
      </div>
    </div>
  );
}

// ==================== AUTH ====================

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

function avatarUrl(name: string): string {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=4285F4&color=fff&rounded=true&bold=true&size=128`;
}

function AuthModal({ onClose }: { onClose: () => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const currentDomain = typeof window !== "undefined" ? window.location.hostname : "";

  useEffect(() => {
    if (!auth) return;
    return onAuthStateChanged(auth, session => { if (session) onClose(); });
  }, [onClose]);

  const handleGoogleSignIn = async () => {
    if (!auth || loading) return;
    setLoading(true);
    setError("");
    try {
      await signInWithPopup(auth, googleProvider);
      onClose();
    } catch (err: any) {
      if (err.code === "auth/popup-closed-by-user" || err.code === "auth/cancelled-popup-request") {
        // user dismissed — no error needed
      } else if (err.code === "auth/unauthorized-domain") {
        setError(`Falta autorizar ${currentDomain} en Firebase → proyecto ${config.projectId} → Authentication → Configuración → Dominios autorizados.`);
      } else if (err.code === "auth/popup-blocked") {
        setError("El navegador bloqueó el popup. Permite popups para este sitio e intenta de nuevo.");
      } else if (err.code === "auth/operation-not-allowed") {
        setError("El proveedor Google todavía no está habilitado en Firebase Authentication.");
      } else if (err.code === "auth/account-exists-with-different-credential") {
        setError("Este correo ya tiene una cuenta con otro método. Entra con ese método en la app original antes de vincular Google; no crees otra cuenta.");
      } else if (err.code === "auth/web-storage-unsupported") {
        setError("Permite el almacenamiento del sitio y abre esta página en Chrome, Edge o Safari.");
      } else if (err.code === "auth/network-request-failed") {
        setError("Sin conexión a internet. Verifica tu conexión e intenta de nuevo.");
      } else {
        setError(`Error: ${err.code || err.message || "desconocido"}. Intenta de nuevo.`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="pt-8 pb-6 px-8 text-center border-b border-gray-100">
          <div className="flex justify-center mb-5"><GoogleIcon /></div>
          <h2 className="text-xl font-normal text-gray-800 mb-1">Iniciar sesión con Google</h2>
          <p className="text-sm text-gray-500">Tu cuenta quedará vinculada a EcoAlert VES</p>
        </div>
        <div className="p-6 space-y-4">
          <button onClick={handleGoogleSignIn} disabled={loading || !auth} className="w-full flex items-center justify-center gap-3 border border-gray-300 rounded-xl py-3.5 px-5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50">
            {loading ? <div className="w-5 h-5 rounded-full animate-spin" style={{ border: "2px solid #ddd", borderTopColor: "#4285F4" }} /> : <GoogleIcon />}
            {loading ? "Abriendo Google…" : "Continuar con Google"}
          </button>
          {!auth && (
            <div className="rounded-xl p-3 text-xs text-orange-700" style={{ backgroundColor: "#FFF3E0" }}>
              <p className="font-semibold mb-1">Modo de demostración</p>
              <p>El inicio de sesión está desactivado en esta vista. <a className="underline" href={window.location.pathname + window.location.hash}>Abrir la versión con Google</a>.</p>
            </div>
          )}
          {error && (
            <div className="rounded-xl p-3 text-xs text-red-700" style={{ backgroundColor: "#FFEBEE" }}>
              <p className="font-semibold mb-1">No se pudo iniciar sesión</p>
              <p>{error}</p>
            </div>
          )}
          <p className="text-[11px] text-gray-400 text-center">Usa la misma cuenta de Google que en EcoAlert móvil. Cada dispositivo mantiene su propia sesión.</p>
        </div>
        <div className="px-6 pb-5"><button onClick={onClose} className="w-full text-sm text-gray-400 hover:text-gray-600 py-2">Cancelar</button></div>
      </motion.div>
    </div>
  );
}

// ==================== ACCOUNT PAGE ====================

function AccountPage({ user, reports, userStats, onSignOut, onSignIn, setPage, theme, setTheme }: {
  user: GoogleUser | null; reports: SubmittedReport[]; userStats: UserStats;
  onSignOut: () => void; onSignIn: () => void; setPage: (p: Page) => void;
  theme: Theme; setTheme: (t: Theme) => void;
}) {
  const [prefs, setPrefs] = useState({ notifications: true, publicProfile: true, emailNews: true });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState(user?.name || "");
  const [editingPhoto, setEditingPhoto] = useState(false);
  const [newPhotoUrl, setNewPhotoUrl] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);

  useEffect(() => {
    if (!user || !db) return;
    getDoc(doc(db, "webProfiles", user.uid)).then(snap => {
      if (snap.exists() && snap.data().prefs) setPrefs(p => ({ ...p, ...snap.data().prefs }));
    }).catch(() => {});
  }, [user?.uid]);

  useEffect(() => { setNewName(user?.name || ""); }, [user?.name]);

  const togglePref = async (key: keyof typeof prefs) => {
    const next = { ...prefs, [key]: !prefs[key] }; setPrefs(next);
    if (!user || !db) return;
    setSaving(true);
    try {
      await setDoc(doc(db, "webProfiles", user.uid), { name: user.name, email: user.email, photoUrl: user.photoUrl, prefs: next }, { merge: true });
      setSaved(true); setTimeout(() => setSaved(false), 2000);
    } catch {} finally { setSaving(false); }
  };

  const saveProfileName = async () => {
    if (!user || !auth?.currentUser || !newName.trim()) return;
    setProfileSaving(true);
    try {
      await updateProfile(auth.currentUser, { displayName: newName.trim() });
      if (db) await setDoc(doc(db, "webProfiles", user.uid), { name: newName.trim() }, { merge: true });
      setProfileSaved(true); setTimeout(() => setProfileSaved(false), 2000);
      setEditingName(false);
    } catch {} finally { setProfileSaving(false); }
  };

  const saveProfilePhoto = async () => {
    if (!user || !auth?.currentUser || !newPhotoUrl.trim()) return;
    setProfileSaving(true);
    try {
      await updateProfile(auth.currentUser, { photoURL: newPhotoUrl.trim() });
      if (db) await setDoc(doc(db, "webProfiles", user.uid), { photoUrl: newPhotoUrl.trim() }, { merge: true });
      setProfileSaved(true); setTimeout(() => setProfileSaved(false), 2000);
      setEditingPhoto(false); setNewPhotoUrl("");
    } catch {} finally { setProfileSaving(false); }
  };

  const myReports = reports.filter(r => r.userName === user?.name);

  if (!user) {
    return (
      <div className="min-h-screen bg-background pb-8">
        <div className="text-white px-4 pt-6 pb-8" style={{ background: "linear-gradient(135deg, #4ADE80, #1565C0)" }}>
          <h1 className="text-2xl font-bold mb-1">Mi cuenta</h1>
          <p className="text-white/70 text-sm">Inicia sesión para gestionar tu perfil y ver tu progreso</p>
        </div>
        <div className="max-w-sm mx-auto px-4 py-10 text-center">
          <div className="w-24 h-24 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-6 shadow-inner"><Users className="w-12 h-12 text-gray-300" /></div>
          <h2 className="text-lg font-bold text-gray-800 mb-2">No has iniciado sesión</h2>
          <p className="text-sm text-gray-400 mb-8 leading-relaxed">Vincula tu cuenta de Google para guardar tu progreso, insignias y reportes en la nube de forma permanente.</p>
          <button onClick={onSignIn} className="flex items-center justify-center gap-3 w-full border border-gray-300 bg-white rounded-xl py-3.5 px-6 text-sm font-semibold text-gray-700 shadow-sm hover:shadow-md transition-shadow">
            <GoogleIcon />Iniciar sesión con Google
          </button>
        </div>
      </div>
    );
  }

  const lvlCfg = LEVEL_CONFIG[userStats.level] || LEVEL_CONFIG["Eco Novato"];

  return (
    <div className="min-h-screen bg-background pb-8">
      <div className="text-white px-4 pt-6 pb-14" style={{ background: "linear-gradient(135deg, #4ADE80, #1565C0)" }}>
        <h1 className="text-2xl font-bold mb-1">Mi cuenta</h1>
        <p className="text-white/70 text-sm">Gestiona tu perfil, preferencias y actividad</p>
      </div>
      <div className="max-w-sm mx-auto px-4 -mt-10 space-y-4">
        {/* Profile card */}
        <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="relative">
              <img src={user.photoUrl} alt={user.name} className="w-20 h-20 rounded-full border-4 border-white shadow-md" onError={e => { (e.target as HTMLImageElement).src = avatarUrl(user.name); }} />
              <button onClick={() => { setEditingPhoto(!editingPhoto); setEditingName(false); }} className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-white shadow-md border border-gray-200 flex items-center justify-center text-xs">✏️</button>
            </div>
            <div className="flex-1 min-w-0">
              {editingName ? (
                <div className="flex items-center gap-2 mb-1">
                  <input value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => { if (e.key === "Enter") saveProfileName(); if (e.key === "Escape") setEditingName(false); }} className="flex-1 border border-gray-300 rounded-lg px-2 py-1 text-sm font-bold text-gray-900 focus:outline-none focus:border-green-500" autoFocus />
                  <button onClick={saveProfileName} disabled={profileSaving} className="text-xs font-semibold text-white px-2 py-1 rounded-lg" style={{ backgroundColor: "#4ADE80" }}>{profileSaving ? "…" : "✓"}</button>
                  <button onClick={() => { setEditingName(false); setNewName(user.name); }} className="text-xs text-gray-400 px-1">✗</button>
                </div>
              ) : (
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-lg font-bold text-gray-900 truncate">{user.name}</h2>
                  <button onClick={() => { setEditingName(true); setEditingPhoto(false); }} className="text-xs text-gray-400 hover:text-gray-600">✏️</button>
                </div>
              )}
              <p className="text-xs text-gray-400 truncate mb-2">{user.email}</p>
              <div className="inline-flex items-center gap-1 bg-blue-50 text-blue-600 text-[10px] font-semibold px-2.5 py-1 rounded-full"><GoogleIcon />Google vinculado</div>
            </div>
          </div>
          {editingPhoto && (
            <div className="mt-2 pt-3 border-t border-gray-100">
              <p className="text-xs text-gray-500 mb-2">URL de la nueva foto de perfil:</p>
              <div className="flex gap-2">
                <input value={newPhotoUrl} onChange={e => setNewPhotoUrl(e.target.value)} placeholder="https://ejemplo.com/foto.jpg" className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-green-500" />
                <button onClick={saveProfilePhoto} disabled={profileSaving || !newPhotoUrl.trim()} className="text-xs font-semibold text-white px-3 py-2 rounded-lg disabled:opacity-50" style={{ backgroundColor: "#4ADE80" }}>{profileSaving ? "…" : "Guardar"}</button>
              </div>
            </div>
          )}
          {profileSaved && <p className="text-xs text-green-600 font-semibold mt-2 text-center">✓ Perfil actualizado</p>}
        </div>

        {/* Gamification summary */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-sm font-bold text-gray-900">{userStats.level}</div>
              <div className="text-xs text-gray-400">{userStats.points.toLocaleString()} puntos acumulados</div>
            </div>
            <span className="text-xs font-semibold px-3 py-1 rounded-full" style={{ backgroundColor: lvlCfg.bg, color: lvlCfg.color }}>⚡ Nivel {userStats.levelNum}</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2 mb-2">
            <div className="h-2 rounded-full transition-all" style={{ width: `${Math.min((userStats.points / lvlCfg.nextPoints) * 100, 100)}%`, background: `linear-gradient(90deg, ${lvlCfg.color}, #FFA726)` }} />
          </div>
          <div className="grid grid-cols-3 gap-2 mt-3">
            {[
              { label: "Reportes", value: userStats.reports, color: "#4ADE80" },
              { label: "Insignias", value: userStats.badges.length, color: "#FBBF24" },
              { label: "Puntos", value: userStats.points, color: "#00D4FF" },
            ].map(s => (
              <div key={s.label} className="text-center rounded-xl py-2" style={{ backgroundColor: s.color + "12" }}>
                <div className="text-lg font-bold" style={{ color: s.color }}>{s.value}</div>
                <div className="text-[10px] text-gray-500">{s.label}</div>
              </div>
            ))}
          </div>
          <button onClick={() => setPage("gamification")} className="w-full mt-3 py-2 rounded-xl text-xs font-semibold text-white" style={{ backgroundColor: "#FBBF24" }}>Ver mi progreso completo →</button>
        </div>

        {/* Theme */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100"><h3 className="font-bold text-gray-900">Tema de la aplicación</h3></div>
          <div className="p-4 grid grid-cols-3 gap-2">
            {([["light", "☀️", "Claro"], ["dark", "🌙", "Oscuro"], ["system", "💻", "Sistema"]] as [Theme, string, string][]).map(([t, icon, label]) => (
              <button key={t} onClick={() => setTheme(t)} className="flex flex-col items-center gap-2 py-4 rounded-xl border-2 transition-all" style={theme === t ? { borderColor: "#4ADE80", backgroundColor: "rgba(74,222,128,0.12)" } : { borderColor: "#E5E7EB", backgroundColor: "white" }}>
                <span className="text-2xl">{icon}</span>
                <span className="text-xs font-semibold" style={{ color: theme === t ? "#4ADE80" : "#6B7280" }}>{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Preferences */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-bold text-gray-900">Preferencias</h3>
            {saving && <div className="w-4 h-4 rounded-full animate-spin" style={{ border: "2px solid #e0e0e0", borderTopColor: "#4ADE80" }} />}
            {saved && <span className="text-xs text-green-600 font-semibold">✓ Guardado</span>}
          </div>
          {[
            { key: "notifications" as const, label: "Notificaciones de alertas", sub: "Avisos de eventos comunitarios cercanos" },
            { key: "emailNews" as const, label: "Anuncios por correo", sub: `Novedades enviadas a ${user.email}` },
            { key: "publicProfile" as const, label: "Perfil público", sub: "Mostrar mi nombre y foto en reportes" },
          ].map(pref => (
            <div key={pref.key} className="px-5 py-4 flex items-center justify-between border-b border-gray-50 last:border-0">
              <div className="flex-1 pr-4"><p className="text-sm font-medium text-gray-800">{pref.label}</p><p className="text-xs text-gray-400">{pref.sub}</p></div>
              <button onClick={() => togglePref(pref.key)} className="w-11 h-6 rounded-full flex-shrink-0 flex items-center px-0.5 transition-colors" style={{ backgroundColor: prefs[pref.key] ? "#4ADE80" : "#D1D5DB" }}>
                <div className="w-5 h-5 rounded-full bg-white shadow-sm transition-transform" style={{ transform: prefs[pref.key] ? "translateX(20px)" : "translateX(0)" }} />
              </button>
            </div>
          ))}
        </div>

        {/* My reports */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-bold text-gray-900">Mis reportes</h3>
            <span className="text-xs text-gray-400">{myReports.length} publicados</span>
          </div>
          {myReports.length === 0 ? (
            <div className="px-5 py-8 text-center text-gray-400 text-sm">Aún no has publicado reportes</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {myReports.slice(0, 4).map(r => {
                const tc = TYPE_CONFIG[r.type];
                return (
                  <div key={r.id} className="px-5 py-3.5 flex items-center gap-3">
                    {r.imageUrl ? <img src={r.imageUrl} alt="" className="w-12 h-12 rounded-xl object-cover flex-shrink-0 bg-gray-100" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} /> : <div className="w-12 h-12 rounded-xl flex-shrink-0 flex items-center justify-center" style={{ backgroundColor: tc.bg }}><Camera className="w-5 h-5" style={{ color: tc.color }} /></div>}
                    <div className="flex-1 min-w-0">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: tc.bg, color: tc.color }}>{tc.label}</span>
                      <p className="text-xs text-gray-600 truncate mt-0.5">{r.description}</p>
                      <p className="text-[10px] text-gray-400">{r.date} {r.time}</p>
                    </div>
                  </div>
                );
              })}
              {myReports.length > 4 && <button onClick={() => setPage("community")} className="w-full px-5 py-3 text-xs font-semibold text-center hover:bg-gray-50" style={{ color: "#00D4FF" }}>Ver todos en Comunidad →</button>}
            </div>
          )}
        </div>

        {/* Quick actions */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100"><h3 className="font-bold text-gray-900">Acciones rápidas</h3></div>
          <div className="grid grid-cols-2 gap-px bg-gray-100">
            {[
              { label: "Nuevo reporte", icon: "📸", color: "#4ADE80", bg: "rgba(74,222,128,0.12)", action: () => setPage("report") },
              { label: "Ver comunidad", icon: "👥", color: "#1565C0", bg: "#E3F2FD", action: () => setPage("community") },
              { label: "Ver mapa", icon: "🗺", color: "#818CF8", bg: "#F3E5F5", action: () => setPage("map") },
              { label: "Mis logros", icon: "🏆", color: "#FBBF24", bg: "#FFF3E0", action: () => setPage("gamification") },
            ].map(a => (
              <button key={a.label} onClick={a.action} className="flex flex-col items-center gap-2 py-4 px-3 bg-white hover:opacity-80 transition-opacity">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{ backgroundColor: a.bg }}>{a.icon}</div>
                <span className="text-xs font-semibold text-gray-700">{a.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Activity summary */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100"><h3 className="font-bold text-gray-900">Mi impacto en VES</h3></div>
          <div className="p-4 space-y-3">
            {[
              { label: "Puntos ganados por reportes", value: `${userStats.reports * 50} pts`, pct: Math.min(100, (userStats.reports * 50 / Math.max(userStats.points, 1)) * 100), color: "#4ADE80" },
              { label: "Apoyos dados a la comunidad", value: (() => { try { return JSON.parse(localStorage.getItem("eco_upvoted") || "[]").length; } catch { return 0; } })() + " apoyos", pct: Math.min(100, (() => { try { return JSON.parse(localStorage.getItem("eco_upvoted") || "[]").length * 10; } catch { return 0; } })()), color: "#FBBF24" },
              { label: "Nivel de actividad", value: userStats.points >= 500 ? "Alto" : userStats.points >= 100 ? "Medio" : "Inicial", pct: Math.min(100, (userStats.points / 500) * 100), color: "#00D4FF" },
            ].map(item => (
              <div key={item.label}>
                <div className="flex justify-between text-xs mb-1"><span className="text-gray-600">{item.label}</span><span className="font-bold" style={{ color: item.color }}>{item.value}</span></div>
                <div className="w-full bg-gray-100 rounded-full h-1.5"><div className="h-1.5 rounded-full transition-all" style={{ width: `${item.pct}%`, backgroundColor: item.color }} /></div>
              </div>
            ))}
          </div>
        </div>

        {/* Badges earned */}
        {userStats.badges.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-bold text-gray-900">Insignias obtenidas</h3>
              <span className="text-xs text-gray-400">{userStats.badges.length} de {Object.keys(BADGE_CONFIG).length}</span>
            </div>
            <div className="p-4 flex flex-wrap gap-2">
              {userStats.badges.map(badge => {
                const cfg = BADGE_CONFIG[badge]; const Icon = cfg?.icon;
                return Icon ? (
                  <div key={badge} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold" style={{ backgroundColor: "#FFF3E0", color: "#FBBF24" }}>
                    <Icon className="w-3.5 h-3.5" />{cfg.label}
                  </div>
                ) : null;
              })}
            </div>
          </div>
        )}

        {/* Help / support */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100"><h3 className="font-bold text-gray-900">Ayuda y soporte</h3></div>
          {[
            { label: "Cómo funciona EcoAlert VES", icon: "📖", action: () => setPage("education") },
            { label: "Ver alertas ecológicas", icon: "🔔", action: () => setPage("alerts") },
            { label: "Ver análisis de contaminación", icon: "📊", action: () => setPage("analysis") },
          ].map(item => (
            <button key={item.label} onClick={item.action} className="w-full flex items-center gap-3 px-5 py-3.5 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors text-left">
              <span className="text-xl">{item.icon}</span>
              <span className="text-sm text-gray-700 flex-1">{item.label}</span>
              <ChevronRight className="w-4 h-4 text-gray-300" />
            </button>
          ))}
        </div>

        <button onClick={onSignOut} className="w-full bg-white border border-red-100 rounded-2xl py-4 text-sm font-semibold text-red-500 shadow-sm hover:bg-red-50 transition-colors flex items-center justify-center gap-2"><X className="w-4 h-4" />Cerrar sesión de Google</button>
        <p className="text-xs text-center text-gray-300 pb-4">EcoAlert VES · Villa El Salvador, Lima</p>
      </div>
    </div>
  );
}

// ==================== NAVBAR ====================

const NAV_ITEMS: { key: Page; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "home",         label: "Inicio",     icon: Home },
  { key: "report",       label: "Reportar",   icon: Camera },
  { key: "community",    label: "Comunidad",  icon: Users },
  { key: "map",          label: "Mapa",       icon: MapPin },
  { key: "alerts",       label: "Alertas",    icon: Bell },
  { key: "gamification", label: "Retos",      icon: Trophy },
  { key: "education",    label: "Aprende",    icon: BookOpen },
  { key: "admin",        label: "Admin",      icon: Settings },
];

function Navbar({ currentPage, setPage, user, onSignIn }: { currentPage: Page; setPage: (p: Page) => void; user: GoogleUser | null; onSignIn: () => void }) {
  const [open, setOpen] = useState(false);
  useEffect(() => { setOpen(false); }, [currentPage]);
  useEffect(() => { const close = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); }; window.addEventListener("keydown", close); return () => window.removeEventListener("keydown", close); }, []);

  return (
    <>
      <nav aria-label="Navegación principal" className="bg-[#0B0F14]/95 backdrop-blur-xl border-b border-border sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 flex items-center h-16 gap-2">
          <button onClick={() => setPage("home")} className="flex items-center gap-2 flex-shrink-0">
            <img src={ecoAlertLogo} alt="EcoAlert VES" className="w-9 h-9 rounded-lg object-contain bg-white" />
            <span className="font-bold text-base tracking-tight"><span style={{ color: "#4ADE80" }}>Eco</span><span style={{ color: "#00D4FF" }}>Alert</span><span className="text-gray-800"> VES</span></span>
          </button>
          <div className="hidden xl:flex items-center gap-0.5 flex-1 mx-2">
            {NAV_ITEMS.map(item => {
              const Icon = item.icon; const active = currentPage === item.key;
              return (
                <button aria-current={active ? "page" : undefined} key={item.key} onClick={() => setPage(item.key)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors" style={active ? { backgroundColor: "rgba(74,222,128,0.12)", color: "#4ADE80" } : { color: "var(--muted-foreground)" }}>
                  <Icon className="w-4 h-4" />{item.label}
                </button>
              );
            })}
          </div>
          <div className="hidden xl:flex items-center gap-2 ml-auto flex-shrink-0">
            {user ? (
              <button onClick={() => setPage("account")} className="flex items-center gap-2 px-3 py-1.5 rounded-xl hover:bg-gray-100 transition-colors">
                <img src={user.photoUrl} alt={user.name} className="w-8 h-8 rounded-full border-2 border-white shadow-sm" onError={e => { (e.target as HTMLImageElement).src = avatarUrl(user.name); }} />
                <span className="text-xs font-semibold text-gray-700 max-w-[100px] truncate">{user.name.split(" ")[0]}</span>
              </button>
            ) : (
              <button onClick={onSignIn} className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
                <GoogleIcon />Iniciar sesión
              </button>
            )}
          </div>
          <div className="xl:hidden ml-auto flex items-center gap-1">
            {user ? <button onClick={() => setPage("account")} className="p-1"><img src={user.photoUrl} alt={user.name} className="w-8 h-8 rounded-full border-2 border-white shadow-sm" onError={e => { (e.target as HTMLImageElement).src = avatarUrl(user.name); }} /></button> : <button onClick={onSignIn} className="p-1.5 rounded-lg"><GoogleIcon /></button>}
            <button className="p-2 rounded-lg text-gray-600" aria-label={open ? "Cerrar menú" : "Abrir menú"} aria-expanded={open} aria-controls="eco-mobile-menu" onClick={() => setOpen(!open)}>{open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}</button>
          </div>
        </div>
        {open && (
          <motion.div id="eco-mobile-menu" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} className="xl:hidden bg-card border-t border-border px-4 py-3 grid grid-cols-4 gap-1.5">
            {NAV_ITEMS.map(item => {
              const Icon = item.icon; const active = currentPage === item.key;
              return (
                <button aria-current={active ? "page" : undefined} key={item.key} onClick={() => { setPage(item.key); setOpen(false); }} className="flex flex-col items-center gap-1 p-2.5 rounded-xl text-[10px] font-semibold transition-colors" style={active ? { backgroundColor: "rgba(74,222,128,0.12)", color: "#4ADE80" } : { color: "#888" }}>
                  <Icon className="w-5 h-5" />{item.label}
                </button>
              );
            })}
          </motion.div>
        )}
      </nav>
    </>
  );
}

// ==================== APP ====================

export default function App() {
  const readPage = (): Page => {
    const key = window.location.hash.replace(/^#\/?/, "") as Page;
    return (["home", "report", "map", "alerts", "gamification", "education", "admin", "community", "account"] as Page[]).includes(key) ? key : "home";
  };
  const [page, setPageState] = useState<Page>(readPage);
  const setPage = (next: Page) => {
    setPageState(next);
    if (next !== "analysis") window.location.hash = `/${next}`;
    window.scrollTo({ top: 0, behavior: "instant" });
  };
  useEffect(() => {
    const onHashChange = () => { setPageState(readPage()); window.scrollTo(0, 0); };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);
  const [analysisData, setAnalysisData] = useState<any>(null);
  const [liveReports, setLiveReports] = useState<SubmittedReport[]>(() => {
    if (db) return [];
    try { return JSON.parse(localStorage.getItem("eco_local_reports") || "[]"); } catch { return []; }
  });
  const [saveError, setSaveError] = useState("");
  const [savingReport, setSavingReport] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [authReady, setAuthReady] = useState(!FIREBASE_READY);
  const [user, setUser] = useState<GoogleUser | null>(null);
  const [userStats, setUserStats] = useState<UserStats>(DEFAULT_STATS);
  const [theme, setThemeState] = useState<Theme>(() => {
    try { return (localStorage.getItem("eco_theme") as Theme) || "dark"; } catch { return "dark"; }
  });

  const setTheme = (t: Theme) => {
    setThemeState(t);
    try { localStorage.setItem("eco_theme", t); } catch {}
  };

  // Apply dark class to <html> based on theme
  useEffect(() => {
    const applyTheme = (t: Theme) => {
      const isDark = t === "dark" || (t === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
      document.documentElement.classList.toggle("dark", isDark);
    };
    applyTheme(theme);
    if (theme === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      const handler = (e: MediaQueryListEvent) => document.documentElement.classList.toggle("dark", e.matches);
      mq.addEventListener("change", handler);
      return () => mq.removeEventListener("change", handler);
    }
  }, [theme]);

  // Firebase auth listener
  useEffect(() => {
    if (!auth) { setAuthReady(true); return; }
    const unsub = onAuthStateChanged(auth, (fbUser: FbUser | null) => {
      if (fbUser) {
        const u: GoogleUser = {
          uid: fbUser.uid,
          name: fbUser.displayName || "Usuario",
          email: fbUser.email || "",
          photoUrl: fbUser.photoURL || avatarUrl(fbUser.displayName || "U"),
        };
        setUser(u);
        if (db) {
          // Match the native app's user schema; never reset existing points or achievements.
          const profileRef = doc(db, "users", fbUser.uid);
          runTransaction(db, async transaction => {
            const snapshot = await transaction.get(profileRef);
            const profile = { uid: fbUser.uid, displayName: fbUser.displayName || "Usuario", email: fbUser.email || "", photoURL: fbUser.photoURL || "" };
            if (!snapshot.exists()) transaction.set(profileRef, { ...profile, ecoPoints: 0, level: 1, achievements: [], reportsCount: 0, createdAt: serverTimestamp() });
            else transaction.set(profileRef, profile, { merge: true });
          }).catch(() => { /* Authentication remains valid even if profile permissions deny the write. */ });
        }
      } else {
        setUser(null);
      }
      setAuthReady(true);
    });
    return unsub;
  }, []);

  // Load user stats — real-time listener when logged in, localStorage for guests
  useEffect(() => {
    if (!user) {
      try {
        const saved = localStorage.getItem("eco_stats_guest");
        setUserStats(saved ? JSON.parse(saved) : DEFAULT_STATS);
      } catch { setUserStats(DEFAULT_STATS); }
      return;
    }
    const lsKey = `eco_stats_${user.uid}`;
    if (!db) {
      try {
        const saved = localStorage.getItem(lsKey);
        setUserStats(saved ? JSON.parse(saved) : DEFAULT_STATS);
      } catch { setUserStats(DEFAULT_STATS); }
      return;
    }
    // Real-time listener — fires immediately on login and on any change from any device
    const unsub = onSnapshot(
      doc(db, "users", user.uid),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          const points = Number(data.ecoPoints) || 0;
          const stats: UserStats = { ...DEFAULT_STATS, ...computeLevel(points), points, reports: Number(data.reportsCount) || 0, badges: data.achievements || [] };
          setUserStats(stats);
          try { localStorage.setItem(lsKey, JSON.stringify(stats)); } catch {}
        } else {
          try {
            const saved = localStorage.getItem(lsKey);
            setUserStats(saved ? JSON.parse(saved) : DEFAULT_STATS);
          } catch { setUserStats(DEFAULT_STATS); }
        }
      },
      () => {
        setSaveError("No se pudo sincronizar tu progreso con Firebase. Revisa la conexión y los permisos de tu cuenta.");
        try {
          const saved = localStorage.getItem(lsKey);
          setUserStats(saved ? JSON.parse(saved) : DEFAULT_STATS);
        } catch { setUserStats(DEFAULT_STATS); }
      }
    );
    return unsub;
  }, [user?.uid]);

  // Firestore live reports listener
  useEffect(() => {
    if (!db) return;
    const q = query(collection(db, "reports"), orderBy("createdAt", "desc"), limit(100));
    const unsub = onSnapshot(q, snap => {
      setLiveReports(snap.docs.map(d => {
        const data = d.data();
        const ts = data.createdAt?.toDate?.() ?? new Date();
        return {
          id: d.id, type: data.type === "agua" ? "aguas" : data.type === "otro" ? "otros" : data.type, description: data.description, status: data.status === "revisado" ? "proceso" : data.status || "pendiente",
          imageUrl: data.imageUrl || null, location: data.location,
          lat: data.latitude ?? null, lng: data.longitude ?? null,
          date: ts.toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" }),
          time: ts.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" }),
          upvotes: data.votes ?? 0, userName: data.userName || "Ciudadano", userPhoto: data.userPhoto || null,
        } as SubmittedReport;
      }));
    }, () => { setSaveError("No se pudieron cargar los reportes compartidos. Revisa los permisos de Firebase."); });
    return unsub;
  }, []);

  // Save stats to Firestore + localStorage
  const saveStats = async (stats: UserStats) => {
    setUserStats(stats);
    const lsKey = user ? `eco_stats_${user.uid}` : "eco_stats_guest";
    try { localStorage.setItem(lsKey, JSON.stringify(stats)); } catch {}
    if (!user || !db) return;
    setDoc(doc(db, "webProfiles", user.uid), { stats }, { merge: true }).catch(() => {});
  };

  const handleSignOut = async () => {
    if (auth) await fbSignOut(auth);
    setUser(null);
    setUserStats(DEFAULT_STATS);
    setPage("home");
  };

  const addReport = async (r: SubmittedReport) => {
    if (savingReport) return;
    setSavingReport(true);
    setSaveError("");
    // Save to Firestore or local
    if (db) {
      try {
        if (!user) throw new Error("Inicia sesión para guardar en la nube");
        let imageUrl = r.imageUrl;
        if (imageUrl?.startsWith("data:")) imageUrl = await compressImage(imageUrl);
        const reportRef = doc(collection(db, "webReports"));
        const profileRef = doc(db, "users", user.uid);
        await runTransaction(db, async transaction => {
          const profile = await transaction.get(profileRef);
          if (!profile.exists()) throw new Error("Perfil pendiente de creación");
          const data = profile.data();
          const points = (Number(data.ecoPoints) || 0) + 50;
          const reports = (Number(data.reportsCount) || 0) + 1;
          transaction.set(reportRef, {
          type: r.type, description: r.description, imageUrl,
          location: r.location, lat: r.lat, lng: r.lng,
          userId: user.uid,
          userName: r.userName, userPhoto: r.userPhoto,
          upvotes: 0, status: "pendiente", timestamp: serverTimestamp(),
          });
          transaction.set(doc(db, "reports", reportRef.id), {
            userId: user.uid, title: r.description.slice(0, 100), description: r.description,
            type: r.type === "aguas" ? "agua" : ["escombros", "otros"].includes(r.type) ? "otro" : r.type,
            severity: "media", location: r.location, latitude: r.lat, longitude: r.lng,
            imageUrl, userName: r.userName, userPhoto: r.userPhoto, status: "pendiente", votes: 0, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
            source: "web", webReportId: reportRef.id,
          });
          transaction.update(profileRef, { ecoPoints: points, reportsCount: reports, level: 1 + Math.floor(points / 100), updatedAt: serverTimestamp() });
        });
      } catch {
        setSaveError(user ? "No se pudo guardar el reporte y su progreso. Comprueba tu conexión y los permisos de Firebase." : "Inicia sesión con Google antes de guardar tu reporte en la nube.");
        setSavingReport(false);
        return;
      }
    } else {
      try {
        const imageUrl = r.imageUrl?.startsWith("data:") ? await compressImage(r.imageUrl) : r.imageUrl;
        const next = [{ ...r, imageUrl, status: "pendiente" as const }, ...liveReports];
        localStorage.setItem("eco_local_reports", JSON.stringify(next));
        setLiveReports(next);
      } catch {
        setSaveError("No queda espacio para guardar la foto en este navegador. Prueba con una imagen más pequeña.");
        setSavingReport(false);
        return;
      }
    }

    // Update user stats: +50 pts, +1 report
    const newReports = userStats.reports + 1;
    const newPoints = userStats.points + 50;
    const { level, levelNum } = computeLevel(newPoints);
    const newBadges = computeBadges({ ...userStats, reports: newReports, points: newPoints, level, levelNum });
    if (!db) await saveStats({ ...userStats, reports: newReports, points: newPoints, level, levelNum, badges: newBadges });

    setSavingReport(false);
    setPage("community");
  };

  if (!authReady) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-white">
        <div className="w-10 h-10 rounded-full animate-spin" style={{ border: "3px solid #e0e0e0", borderTopColor: "#4ADE80" }} />
      </div>
    );
  }

  const renderPage = () => {
    switch (page) {
      case "home":         return <HomePage setPage={setPage} liveReports={liveReports} />;
      case "report":       return <ReportPage setPage={setPage} setAnalysisData={setAnalysisData} user={user} />;
      case "analysis":     return <AIAnalysisPage analysisData={analysisData} setPage={setPage} addReport={addReport} user={user} />;
      case "map":          return <MapPage liveReports={liveReports} />;
      case "alerts":       return <AlertsPage />;
      case "gamification": return <GamificationPage userStats={userStats} user={user} />;
      case "education":    return <EducationPage />;
      case "admin":        return <AdminPage liveReports={liveReports} />;
      case "community":    return <CommunityPage reports={liveReports} setPage={setPage} currentUser={user} />;
      case "account":      return <AccountPage user={user} reports={liveReports} userStats={userStats} onSignOut={handleSignOut} onSignIn={() => setShowAuth(true)} setPage={setPage} theme={theme} setTheme={setTheme} />;
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {!FIREBASE_READY && <div className="bg-primary/10 text-primary text-center px-4 py-2 text-xs" role="status">Modo de prueba local · Tus reportes se guardan solo en este navegador.</div>}
      <Navbar currentPage={page} setPage={setPage} user={user} onSignIn={() => setShowAuth(true)} />
      <motion.main id="contenido" key={page} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
        {renderPage()}
      </motion.main>
      {saveError && <div role="alert" className="fixed bottom-5 left-4 right-4 mx-auto max-w-lg rounded-xl border border-red-400/40 bg-[#291b23] text-red-100 p-4 z-[100] flex items-start gap-3"><span className="flex-1">{saveError}</span><button aria-label="Cerrar aviso" onClick={() => setSaveError("")}><X size={18} /></button></div>}
      {savingReport && <div role="status" className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center"><p className="bg-card rounded-xl px-8 py-6">Guardando reporte…</p></div>}
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
    </div>
  );
}
