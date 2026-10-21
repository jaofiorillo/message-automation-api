-- CreateTable
CREATE TABLE "CommentTrigger" (
    "id" SERIAL NOT NULL,
    "flowId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "mediaIds" TEXT[],
    "includeKeywords" TEXT[],
    "excludeKeywords" TEXT[],
    "rootCommentsOnly" BOOLEAN NOT NULL DEFAULT false,
    "publicReplies" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommentTrigger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contact" (
    "id" SERIAL NOT NULL,
    "channel" "Channel" NOT NULL,
    "externalId" TEXT NOT NULL,
    "username" TEXT,
    "lastInteractionAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InboundEvent" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InboundEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Contact_channel_externalId_key" ON "Contact"("channel", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "InboundEvent_key_key" ON "InboundEvent"("key");

-- AddForeignKey
ALTER TABLE "CommentTrigger" ADD CONSTRAINT "CommentTrigger_flowId_fkey" FOREIGN KEY ("flowId") REFERENCES "Flow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

