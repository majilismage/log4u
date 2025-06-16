import type React from "react"
import Link from "next/link"
import Image from "next/image"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { MapPin, Users, Shield, Globe, Camera, BookOpen, Rocket, Home } from "lucide-react"
import { SignInButton } from "@/components/auth/SignInButton"

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-emerald-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <div className="container mx-auto px-4 py-12 md:px-6 lg:px-8">
        
        {/* Hero Section */}
        <div className="text-center mb-8 pt-12">
          <div className="flex flex-col items-center justify-center mb-6">
            <Image 
              src="/wandernote-logo.png" 
              alt="WanderNote Logo" 
              width={150} 
              height={60} 
              className="mb-4"
              priority
            />
            <h1 className="text-4xl md:text-6xl font-bold bg-gradient-to-r from-blue-600 to-emerald-600 bg-clip-text text-transparent">
              WanderNote
            </h1>
          </div>
          <p className="text-xl md:text-2xl text-muted-foreground mb-8 max-w-3xl mx-auto">
            Your personal digital travel journal, where every adventure becomes a lasting memory
          </p>
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground mb-8">
            <span>Crafted by</span>
            <Link 
              href="https://3g-international.com/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center font-semibold text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
            >
              <Image 
                src="/3gis_white.png" 
                alt="3GIS" 
                width={32} 
                height={16} 
                className="inline-block"
              />
            </Link>
          </div>

          {/* Sign In Button */}
          <div className="max-w-sm mx-auto">
            <SignInButton providerId="google" providerName="Google" />
          </div>
        </div>

        {/* Mission Statement */}
        <Card className="mb-16 border-2 border-blue-100 dark:border-slate-700">
          <CardContent className="p-8 md:p-12">
            <div className="flex items-start gap-6">
              <div className="hidden md:block">
                <Rocket className="h-12 w-12 text-blue-600 dark:text-blue-400 mt-2" />
              </div>
              <div>
                <h2 className="text-2xl md:text-3xl font-bold mb-4 text-foreground">Our Mission</h2>
                <p className="text-lg text-muted-foreground leading-relaxed mb-4">
                  WanderNote was born from a simple belief: every journey, no matter how big or small, deserves to be remembered. 
                  Whether you're sailing across oceans, exploring new cities, or taking weekend road trips, your adventures are 
                  worth documenting with the detail and care they deserve.
                </p>
                <p className="text-lg text-muted-foreground leading-relaxed">
                  We're here to help modern adventurers, sailors, RV enthusiasts, digital nomads, and weekend explorers, create 
                  a comprehensive digital logbook that captures not just where you went, but how it felt to be there.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Core Values Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
          <Card className="group hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
            <CardContent className="p-6">
              <Shield className="h-10 w-10 text-emerald-600 dark:text-emerald-400 mb-4 group-hover:scale-110 transition-transform" />
                             <h3 className="text-xl font-semibold mb-3">Your Data, Forever Yours</h3>
               <p className="text-muted-foreground">
                 Your travel memories are stored exclusively in YOUR Google Drive and Sheets. We never store your data. 
                 Even if WanderNote disappears tomorrow, your adventures remain safely in your possession forever.
               </p>
            </CardContent>
          </Card>

          <Card className="group hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
            <CardContent className="p-6">
              <MapPin className="h-10 w-10 text-blue-600 dark:text-blue-400 mb-4 group-hover:scale-110 transition-transform" />
              <h3 className="text-xl font-semibold mb-3">Precision Tracking</h3>
              <p className="text-muted-foreground">
                Smart location autocomplete, GPS coordinates, and detailed journey metrics help you capture 
                every aspect of your travels with accuracy.
              </p>
            </CardContent>
          </Card>

          <Card className="group hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
            <CardContent className="p-6">
              <Camera className="h-10 w-10 text-purple-600 dark:text-purple-400 mb-4 group-hover:scale-110 transition-transform" />
              <h3 className="text-xl font-semibold mb-3">Rich Media</h3>
              <p className="text-muted-foreground">
                Upload photos and videos that bring your stories to life. Our organized gallery makes it easy 
                to relive your favorite moments from any journey.
              </p>
            </CardContent>
          </Card>

          <Card className="group hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
            <CardContent className="p-6">
              <BookOpen className="h-10 w-10 text-orange-600 dark:text-orange-400 mb-4 group-hover:scale-110 transition-transform" />
              <h3 className="text-xl font-semibold mb-3">Detailed Journaling</h3>
              <p className="text-muted-foreground">
                Beyond just locations and dates—capture distances traveled, speeds, notes, and all the details 
                that make each journey unique and memorable.
              </p>
            </CardContent>
          </Card>

          <Card className="group hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
            <CardContent className="p-6">
              <Globe className="h-10 w-10 text-teal-600 dark:text-teal-400 mb-4 group-hover:scale-110 transition-transform" />
              <h3 className="text-xl font-semibold mb-3">Always Accessible</h3>
              <p className="text-muted-foreground">
                Web-based and mobile-optimized, WanderNote goes wherever you do. Access your travel history 
                from any device, anywhere in the world.
              </p>
            </CardContent>
          </Card>

          <Card className="group hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
            <CardContent className="p-6">
              <Users className="h-10 w-10 text-rose-600 dark:text-rose-400 mb-4 group-hover:scale-110 transition-transform" />
              <h3 className="text-xl font-semibold mb-3">Built for Travelers</h3>
              <p className="text-muted-foreground">
                Designed by and for people who understand the importance of preserving travel memories. 
                Every feature serves the adventurer's need to document and remember.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* About 3G International */}
        <Card className="mb-16 bg-gradient-to-r from-slate-50 to-blue-50 dark:from-slate-800 dark:to-slate-700 border-slate-200 dark:border-slate-600">
          <CardContent className="p-8 md:p-12">
                         <h2 className="text-2xl md:text-3xl font-bold mb-6 text-center flex items-center justify-center gap-2">
               About 
               <Image 
                 src="/3gis_white.png" 
                 alt="3GIS" 
                 width={48} 
                 height={24} 
                 className="inline-block"
               />
             </h2>
             <div className="max-w-4xl mx-auto">
               <p className="text-lg text-muted-foreground leading-relaxed mb-6 text-center">
                 <strong className="text-foreground">Redefining Digital Excellence.</strong> Where innovation meets execution across industries.
               </p>
               <p className="text-muted-foreground leading-relaxed mb-6">
                 WanderNote is proudly developed by <Link href="https://3g-international.com/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center font-semibold text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors">
                   <Image 
                     src="/3gis_white.png" 
                     alt="3GIS" 
                     width={28} 
                     height={14} 
                     className="inline-block"
                   />
                 </Link> - 
                 a technology company that operates at the intersection of innovation and practical solutions. 
                 We specialize in creating applications that don't just meet expectations, they redefine them.
               </p>
               <p className="text-muted-foreground leading-relaxed mb-6">
                 Our expertise spans cyber security consulting, product management, e-commerce solutions, SaaS development, 
                 digital education, and strategic consulting. This diverse background allows us to bring enterprise-level 
                 security, scalability, and user experience to every application we create.
               </p>
               <p className="text-muted-foreground leading-relaxed">
                 WanderNote embodies our philosophy of transforming complexity into clarity. We take the sophisticated challenge 
                 of comprehensive travel logging and make it beautifully simple for adventurers everywhere.
               </p>
             </div>
          </CardContent>
        </Card>

        {/* CTA Section */}
        <div className="text-center">
          <Card className="inline-block border-2 border-blue-200 dark:border-blue-800 bg-gradient-to-br from-blue-50 to-emerald-50 dark:from-blue-900/20 dark:to-emerald-900/20">
            <CardContent className="p-8">
                             <h2 className="text-2xl md:text-3xl font-bold mb-4">Ready to Start Your Journey?</h2>
               <p className="text-muted-foreground mb-6 max-w-2xl">
                 Join thousands of adventurers who trust WanderNote to preserve their travel memories. 
                 <strong className="text-foreground">Always free, no credit card required.</strong> Optional premium features available.
               </p>
               <Button asChild size="lg" className="bg-gradient-to-r from-blue-600 to-emerald-600 hover:from-blue-700 hover:to-emerald-700 text-white font-semibold px-8 py-3">
                 <Link href="/dashboard">Get Started Free</Link>
               </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
